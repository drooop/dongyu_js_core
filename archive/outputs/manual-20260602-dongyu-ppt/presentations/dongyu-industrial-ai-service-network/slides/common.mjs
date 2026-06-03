export const W = 1280;
export const H = 720;

export const C = {
  paper: "#F7F8F6",
  white: "#FFFFFF",
  ink: "#18212F",
  steel: "#234E5F",
  teal: "#0B7774",
  copper: "#B36B2C",
  red: "#9B3F36",
  gray: "#657180",
  line: "#D9DEE2",
  mist: "#EBEFF2",
  faint: "#EEF2F3",
};

export const F = {
  title: "Noto Sans CJK SC",
  body: "Noto Sans CJK SC",
  latin: "IBM Plex Sans",
};

export function bg(slide, ctx) {
  ctx.addShape(slide, {
    left: 0,
    top: 0,
    width: W,
    height: H,
    fill: C.paper,
    line: ctx.line("none", 0),
    name: "background",
  });
}

export function line(slide, ctx, x, y, w, color = C.line, h = 1) {
  return ctx.addShape(slide, {
    left: x,
    top: y,
    width: w,
    height: h,
    fill: color,
    line: ctx.line("none", 0),
    name: "hairline",
  });
}

export function rect(slide, ctx, x, y, w, h, fill, stroke = C.line, strokeWidth = 1, name = "rect") {
  return ctx.addShape(slide, {
    left: x,
    top: y,
    width: w,
    height: h,
    fill,
    line: stroke === "none" ? ctx.line("none", 0) : ctx.line(stroke, strokeWidth),
    name,
  });
}

export function text(slide, ctx, value, x, y, w, h, options = {}) {
  return ctx.addText(slide, {
    text: value,
    left: x,
    top: y,
    width: w,
    height: h,
    fontSize: options.size ?? 20,
    color: options.color ?? C.ink,
    bold: options.bold ?? false,
    typeface: options.face ?? F.body,
    align: options.align ?? "left",
    valign: options.valign ?? "top",
    fill: options.fill ?? "none",
    line: ctx.line("none", 0),
    insets: options.insets ?? { left: 0, right: 0, top: 0, bottom: 0 },
    name: options.name ?? "text",
  });
}

export function kicker(slide, ctx, label, num, accent = C.teal) {
  rect(slide, ctx, 76, 58, 38, 3, accent, "none", 0, "kicker-marker");
  text(slide, ctx, label, 124, 48, 360, 24, {
    size: 12,
    color: C.gray,
    bold: true,
    face: F.latin,
    valign: "middle",
    name: "kicker-label",
  });
  text(slide, ctx, num, 1138, 48, 70, 24, {
    size: 12,
    color: C.gray,
    face: F.latin,
    align: "right",
    valign: "middle",
    name: "page-marker",
  });
}

export function title(slide, ctx, value, y = 92, w = 800) {
  text(slide, ctx, value, 76, y, w, 88, {
    size: 40,
    color: C.ink,
    bold: true,
    face: F.title,
    name: "claim-title",
  });
}

export function titleBox(slide, ctx, value, x, y, w, h, size = 40) {
  text(slide, ctx, value, x, y, w, h, {
    size,
    color: C.ink,
    bold: true,
    face: F.title,
    name: "claim-title",
  });
}

export function note(slide, ctx, value, y = 186, w = 760) {
  text(slide, ctx, value, 78, y, w, 58, {
    size: 19,
    color: C.gray,
    face: F.body,
    name: "support-note",
  });
}

export function footer(slide, ctx, page, source = "Source: 上海洞宇与合肥洞宇联合商业计划书 V1.6") {
  line(slide, ctx, 76, 670, 1060, C.line, 1);
  text(slide, ctx, source, 76, 682, 700, 18, {
    size: 10,
    color: C.gray,
    face: F.latin,
    name: "footer-source",
  });
  text(slide, ctx, String(page).padStart(2, "0"), 1120, 682, 60, 18, {
    size: 10,
    color: C.gray,
    face: F.latin,
    align: "right",
    name: "footer-page",
  });
}

export function metric(slide, ctx, x, y, w, label, value, accent = C.teal) {
  rect(slide, ctx, x, y, w, 82, C.white, C.line, 1, "metric-box");
  rect(slide, ctx, x, y, 4, 82, accent, "none", 0, "metric-accent");
  text(slide, ctx, label, x + 20, y + 16, w - 36, 18, {
    size: 13,
    color: C.gray,
    bold: true,
    face: F.body,
    name: "metric-label",
  });
  text(slide, ctx, value, x + 20, y + 40, w - 36, 28, {
    size: 22,
    color: C.ink,
    bold: true,
    face: F.title,
    name: "metric-value",
  });
}

export function smallLabel(slide, ctx, value, x, y, w, accent = C.steel) {
  rect(slide, ctx, x, y, 16, 3, accent, "none", 0, "label-mark");
  text(slide, ctx, value, x + 24, y - 8, w - 24, 18, {
    size: 12,
    color: C.gray,
    bold: true,
    face: F.latin,
    name: "small-label",
  });
}
