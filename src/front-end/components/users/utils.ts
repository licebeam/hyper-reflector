function parseMatchData(rawData) {
    const result = {}
    const lines = rawData
        .split('\n')
        .map((line) => line.trim())
        .filter((line) => line.length > 0)

    console.log(lines)
    // Iterate through the lines and process key-value pairs
    for (let line of lines) {
        const [key, value] = line.split(':')

        // Parse the value as a number, if possible
        const parsedValue = isNaN(value) ? value : Number(value)

        // Handle multiple occurrences of keys (store them in arrays)
        if (result[key]) {
            if (!Array.isArray(result[key])) {
                result[key] = [result[key]] // Convert to array if needed
            }
            result[key].push(parsedValue)
        } else {
            result[key] = parsedValue
        }
    }

    return result
}

export { parseMatchData }
