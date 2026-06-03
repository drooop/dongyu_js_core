import { bg, C, footer, kicker, line, note, rect, text, titleBox } from "./common.mjs";

export async function slide03(presentation, ctx) {
  const slide = presentation.slides.add();
  bg(slide, ctx);
  kicker(slide, ctx, "MARKET SHIFT", "03", C.teal);
  titleBox(slide, ctx, "AI 真正进入工业，\n前提是把生产过程变成可交付订单流量。", 76, 92, 980, 104, 38);
  note(slide, ctx, "AI 已经完成信息层突破；进入工业意味着进入订单、质量、设备、安全和责任边界，价值更大，落地也更难。", 198, 900);

  const x = 86;
  const y = 292;
  const widths = [200, 310, 340];
  const headers = ["传统对象", "数字化后的流通形态", "商业结果"];
  let cx = x;
  headers.forEach((h, i) => {
    rect(slide, ctx, cx, y, widths[i], 42, C.steel, "none", 0, "table-header");
    text(slide, ctx, h, cx + 18, y + 12, widths[i] - 32, 18, { size: 15, color: C.white, bold: true });
    cx += widths[i];
  });

  const rows = [
    ["公司", "股权、股票、基金份额", "资本流动与估值交易"],
    ["渠道", "流量、用户、推荐位", "广告、电商、内容分发"],
    ["算力", "API、Token、模型服务", "云计算与 AI 服务"],
    ["工业过程", "需求、订单、交付、验收记录", "AI 进入实体生产"],
  ];
  rows.forEach((row, r) => {
    cx = x;
    const top = y + 42 + r * 72;
    const fill = r === 3 ? "#F5EEE6" : C.white;
    const stroke = r === 3 ? C.copper : C.line;
    row.forEach((cell, i) => {
      rect(slide, ctx, cx, top, widths[i], 72, fill, stroke, 1, "market-table-cell");
      text(slide, ctx, cell, cx + 18, top + 22, widths[i] - 34, 28, {
        size: i === 0 ? 18 : 17,
        color: r === 3 && i === 2 ? C.copper : C.ink,
        bold: r === 3 || i === 0,
      });
      cx += widths[i];
    });
  });

  line(slide, ctx, x + widths[0] + widths[1] + widths[2], y + 42 + 3 * 72 + 36, 54, C.copper, 2);
  rect(slide, ctx, 1012, 338, 134, 154, C.white, C.teal, 1, "ods-proof");
  text(slide, ctx, "ODS", 1044, 360, 70, 48, { size: 32, color: C.teal, bold: true, align: "center" });
  text(slide, ctx, "Order\nDelivery\nSystem", 1038, 412, 86, 58, { size: 12.8, color: C.ink, align: "center" });
  text(slide, ctx, "工业需求被转译为\n订单交付闭环", 996, 504, 170, 42, { size: 14, color: C.gray, align: "center" });

  rect(slide, ctx, 86, 608, 850, 42, "#EAF4F3", C.teal, 1, "market-conclusion");
  text(slide, ctx, "结论：工业 AI 的入口不是更多模型调用，而是让模型意图进入可履约、可验收、可结算的订单交付系统。", 112, 618, 800, 22, {
    size: 15,
    color: C.teal,
    bold: true,
    align: "center",
  });

  footer(slide, ctx, 3);
  return slide;
}
