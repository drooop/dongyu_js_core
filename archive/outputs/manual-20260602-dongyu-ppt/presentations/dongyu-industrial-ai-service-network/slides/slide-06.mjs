import { bg, C, footer, kicker, note, rect, text, titleBox } from "./common.mjs";

export async function slide06(presentation, ctx) {
  const slide = presentation.slides.add();
  bg(slide, ctx);
  kicker(slide, ctx, "ORDER DELIVERY SYSTEM", "06", C.teal);
  titleBox(slide, ctx, "ODS 是订单交付系统，\n比 Token、点击和字节更接近工业价值。", 76, 88, 880, 106, 38);
  note(slide, ctx, "ODS 把外部需求转成可履约订单，再把订单拆成现场任务、验收记录、审计账本和结算依据。", 214, 860);

  const parts = [
    ["Order", "订单入口", "需求、客户、工种、价格、时限、验收口径"],
    ["Delivery", "交付闭环", "派工、执行、异常、回写、验收、责任确认"],
    ["System", "系统账本", "状态、审计、计费、结算、复盘和渠道分成"],
  ];
  parts.forEach((p, i) => {
    const x = 90 + i * 306;
    rect(slide, ctx, x, 278, 260, 150, C.white, i === 2 ? C.copper : C.teal, 1, "ods-part");
    text(slide, ctx, p[0], x + 24, 300, 150, 42, { size: 28, color: i === 2 ? C.copper : C.teal, bold: true });
    text(slide, ctx, p[1], x + 24, 348, 160, 22, { size: 18, color: C.ink, bold: true });
    text(slide, ctx, p[2], x + 24, 374, 214, 34, { size: 12.5, color: C.gray });
  });

  const x = 92;
  const y = 486;
  const widths = [190, 245, 245, 245];
  const headers = ["流量口径", "说明什么", "工业价值连接", "交易 / 审计 / 结算价值"];
  let cx = x;
  headers.forEach((h, i) => {
    rect(slide, ctx, cx, y, widths[i], 38, C.steel, "none", 0, "comparison-header");
    text(slide, ctx, h, cx + 14, y + 10, widths[i] - 24, 16, { size: 13, color: C.white, bold: true });
    cx += widths[i];
  });

  const rows = [
    ["字节 / Token / 点击", "信息或交互发生过", "难以直接绑定质量、责任和交付", "可计量信息，不足以结算生产动作"],
    ["ODS 订单交付流量", "需求进入订单并完成交付闭环", "可连接收入、成本、质量、责任和客户验收", "可作为工业服务交易、审计和分成依据"],
  ];
  rows.forEach((row, r) => {
    cx = x;
    const top = y + 38 + r * 58;
    const fill = r === 1 ? "#EAF4F3" : C.white;
    const stroke = r === 1 ? C.teal : C.line;
    row.forEach((cell, i) => {
      rect(slide, ctx, cx, top, widths[i], 58, fill, stroke, 1, "comparison-cell");
      text(slide, ctx, cell, cx + 14, top + 12, widths[i] - 24, 34, { size: 13, color: r === 1 && i === 0 ? C.teal : C.ink, bold: r === 1 && i === 0 });
      cx += widths[i];
    });
  });

  footer(slide, ctx, 6);
  return slide;
}
