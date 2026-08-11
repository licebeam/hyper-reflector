use serde_json::{json, Value};
use std::fs;
use std::path::PathBuf;

#[derive(serde::Serialize)]
pub struct ExtractResult {
    pub out_path: String,
    /// First color [r,g,b] of each slot for quick preview
    pub previews: Vec<(u32, [u8; 3])>,
    pub total_palette_entries: usize,
}

/// Extract an indexed PNG's palette and write a costume JSON file.
///
/// `slots`     — which slot numbers to populate
/// `count`     — palette entries per slot (default 64)
/// `offset`    — skip this many entries at the start of the palette
/// `replicate` — if true, every slot gets the SAME block [offset..offset+count]
///               if false, slots get sequential chunks (slot[0]=offset, slot[1]=offset+count, …)
pub fn extract_to_json(
    png_path: &str,
    color_index: u32,
    slots: &[u32],
    count: usize,
    offset: usize,
    replicate: bool,
) -> Result<ExtractResult, String> {
    let slots = if slots.is_empty() { &[0u32, 6] } else { slots };
    let count = if count == 0 { 64 } else { count };

    let colors = read_png_palette(png_path)?;

    let mut slot_map = serde_json::Map::new();
    let mut previews = Vec::new();

    for (idx, &slot_num) in slots.iter().enumerate() {
        let pos = if replicate { offset } else { offset + idx * count };

        let block: Vec<Value> = (pos..pos + count)
            .map(|i| {
                let [r, g, b] = if i < colors.len() { colors[i] } else { [0, 0, 0] };
                json!([r, g, b])
            })
            .collect();

        if pos < colors.len() {
            previews.push((slot_num, colors[pos]));
        }

        slot_map.insert(slot_num.to_string(), Value::Array(block));
    }

    let data = json!({ "slots": slot_map });
    let json_str = serde_json::to_string_pretty(&data).map_err(|e| e.to_string())?;

    let out_path = output_path(png_path, color_index)?;
    if let Some(parent) = out_path.parent() {
        fs::create_dir_all(parent).map_err(|e| format!("mkdir: {e}"))?;
    }
    fs::write(&out_path, &json_str).map_err(|e| format!("write: {e}"))?;

    Ok(ExtractResult {
        out_path: out_path.to_string_lossy().into_owned(),
        previews,
        total_palette_entries: colors.len(),
    })
}

/// Read an indexed PNG and return its palette as a Vec of [R,G,B] triples.
fn read_png_palette(path: &str) -> Result<Vec<[u8; 3]>, String> {
    let file = fs::File::open(path).map_err(|e| format!("Cannot open '{path}': {e}"))?;
    let decoder = png::Decoder::new(file);
    let reader = decoder.read_info().map_err(|e| format!("PNG decode: {e}"))?;
    let info = reader.info();

    if info.color_type == png::ColorType::Indexed {
        if let Some(palette) = &info.palette {
            return Ok(palette.chunks(3).map(|c| [c[0], c[1], c[2]]).collect());
        }
    }

    Err(format!(
        "'{path}' is not an indexed-color PNG (color type: {:?}). \
         Save the image as PNG-8 / indexed in your editor and try again.",
        info.color_type
    ))
}

fn output_path(png_path: &str, color_index: u32) -> Result<PathBuf, String> {
    let base = PathBuf::from(png_path);
    let dir = base.parent().ok_or("PNG has no parent directory")?;
    Ok(dir.join(format!("color{color_index}.json")))
}
