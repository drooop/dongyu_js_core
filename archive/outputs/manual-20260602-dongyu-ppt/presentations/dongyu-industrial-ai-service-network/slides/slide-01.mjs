import { bg, C, F, footer, line, metric, rect, text } from "./common.mjs";

export async function slide01(presentation, ctx) {
  const slide = presentation.slides.add();
  bg(slide, ctx);

  line(slide, ctx, 76, 58, 1060, C.line, 1);
  text(slide, ctx, "CONFIDENTIAL BUSINESS PLAN", 76, 74, 360, 20, {
    size: 12,
    color: C.gray,
    bold: true,
    face: F.latin,
  });
  text(slide, ctx, "上海洞宇 + 合肥洞宇", 920, 74, 220, 20, {
    size: 14,
    color: C.gray,
    align: "right",
  });

  text(slide, ctx, "万态网工业 AI 服务网络", 76, 138, 820, 74, {
    size: 58,
    color: C.ink,
    bold: true,
    face: F.title,
  });
  text(slide, ctx, "把 AI 进入工业的入口，做成可运营、可审计、可结算的订单交付渠道。", 80, 230, 820, 58, {
    size: 24,
    color: C.steel,
    face: F.body,
  });

  metric(slide, ctx, 76, 352, 255, "PROJECT POSITION", "AI 到工业服务的渠道", C.steel);
  metric(slide, ctx, 352, 352, 255, "ORDER SYSTEM", "ODS 订单交付系统", C.teal);
  metric(slide, ctx, 628, 352, 255, "FIELD BOUNDARY", "现场智脑 + 智慧模型", C.teal);
  metric(slide, ctx, 904, 352, 220, "FIRST STAGE", "5,000 万元", C.copper);

  const y = 512;
  line(slide, ctx, 76, y + 78, 1050, C.teal, 2);
  const nodes = [
    ["01", "需求进入", "Demand"],
    ["02", "服务目录", "Catalog"],
    ["03", "智慧模型", "Model"],
    ["04", "现场智脑", "Site Brain"],
    ["05", "PIC 接入", "Field Node"],
    ["06", "DE/V1N", "Execution"],
    ["07", "交付结算", "Settlement"],
  ];
  nodes.forEach((node, i) => {
    const x = 82 + i * 158;
    const accent = i === 6 ? C.copper : C.teal;
    rect(slide, ctx, x, y + 70, 14, 14, accent, "none", 0, "flow-tick");
    rect(slide, ctx, x + 7, y + 36, 1, 34, accent, "none", 0, "flow-stem");
    text(slide, ctx, node[0], x - 8, y, 46, 18, { size: 12, color: accent, bold: true, face: F.latin, align: "center" });
    text(slide, ctx, node[1], x - 4, y + 24, 120, 20, { size: 15, color: C.ink, bold: true });
    text(slide, ctx, node[2], x - 4, y + 48, 120, 16, { size: 9.5, color: C.gray, face: F.latin });
  });

  footer(slide, ctx, 1, "Business Plan V1.6 · 2026-06-02");
  return slide;
}
