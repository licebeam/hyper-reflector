import { useCallback, useMemo } from "react";
import { keyframes } from "@emotion/react";
import bgImage from "../../assets/bgImage.svg";
import type { ThemeSemanticColors } from "../../theme/types";

export function useLayoutChromeStyles(semanticColors?: ThemeSemanticColors) {
  const withAlpha = useCallback((color: string | undefined, alpha: number) => {
    if (!color) {
      return `rgba(0,0,0,${alpha})`;
    }
    const hex = color.replace("#", "");
    if (hex.length === 3) {
      const [r, g, b] = hex.split("").map((ch) => parseInt(ch + ch, 16));
      return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    }
    if (hex.length === 6) {
      const r = parseInt(hex.slice(0, 2), 16);
      const g = parseInt(hex.slice(2, 4), 16);
      const b = parseInt(hex.slice(4, 6), 16);
      return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    }
    return color;
  }, []);

  const layoutBackground = useMemo(() => {
    if (!semanticColors) {
      return { bg: "bg.canvas" as const, overlay: undefined as string | undefined };
    }
    const canvas = semanticColors.canvas ?? semanticColors.background;
    const surface = withAlpha(semanticColors.surface ?? canvas, 0.7);
    const background = withAlpha(semanticColors.background ?? canvas, 0.95);
    const overlay = `radial-gradient(circle at top, ${surface} 0%, ${background} 80%)`;
    return { bg: canvas ?? "bg.canvas", overlay };
  }, [semanticColors, withAlpha]);

  const borderColorValue = semanticColors?.border ?? "border";
  const popoverBgValue = semanticColors?.popover ?? "bg.popover";
  const mutedBgValue = semanticColors?.muted ?? "bg.muted";
  const mutedLabelColor = semanticColors?.textMuted ?? "fg.muted";

  const popoverSurfaceStyles = useMemo(
    () => ({
      bg: popoverBgValue,
      borderColor: borderColorValue,
      borderWidth: "1px",
      borderRadius: "xl",
    }),
    [popoverBgValue, borderColorValue]
  );

  const navPanelStyles = useMemo(
    () => ({
      bg: popoverBgValue,
      borderWidth: "1px",
      borderColor: borderColorValue,
      borderRadius: "xl",
      borderRightWidth: "1px",
    }),
    [popoverBgValue, borderColorValue]
  );

  const headerStyles = useMemo(
    () => ({
      bg: mutedBgValue,
      borderBottom: "1px solid",
      borderColor: borderColorValue,
    }),
    [mutedBgValue, borderColorValue]
  );

  const footerStyles = useMemo(
    () => ({
      bg: mutedBgValue,
      borderColor: borderColorValue,
    }),
    [mutedBgValue, borderColorValue]
  );

  const scrollBackgroundAnimation = useMemo(
    () =>
      keyframes`
        from { background-position: center center, 0 0; }
        to { background-position: center center, -800px 800px; }
      `,
    []
  );

  const backgroundImageValue = useMemo(() => {
    if (layoutBackground.overlay) {
      return `${layoutBackground.overlay}, url(${bgImage})`;
    }
    return `url(${bgImage})`;
  }, [layoutBackground.overlay]);

  return {
    layoutBackground,
    navPanelStyles,
    headerStyles,
    footerStyles,
    mutedLabelColor,
    scrollBackgroundAnimation,
    backgroundImageValue,
    popoverSurfaceStyles,
  };
}
