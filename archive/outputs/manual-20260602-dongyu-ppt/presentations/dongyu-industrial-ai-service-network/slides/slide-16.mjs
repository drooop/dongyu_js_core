import { bg, C, footer, kicker, line, rect, text, titleBox } from "./common.mjs";

export async function slide16(presentation, ctx) {
  const slide = presentation.slides.add();
  bg(slide, ctx);
  kicker(slide, ctx, "INVESTOR POSITION", "16", C.copper);
  titleBox(slide, ctx, "首位产业投资人的价值，\n在于提前进入工业 AI 服务渠道位置。", 76, 96, 900, 112, 40);

  text(slide, ctx, "项目完成首期样板、服务包和商业证据后，将从技术团队升级为具备平台资产、场景资产和资本接力条件的工业 AI 公司。", 80, 230, 840, 58, {
    size: 22,
    color: C.steel,
  });

  const ladder = [
    ["技术入口", "AI 到工业现场的白箱执行底座"],
    ["渠道入口", "合肥首批工厂、园区、劳务市场和工种服务样板机会"],
    ["产品入口", "现场智脑、智慧模型、PIC、DE、V1N 和 ODS 订单交付系统"],
    ["资本入口", "后续产业基金、战略客户、区域平台参与前的优先位置"],
  ];
  ladder.forEach((item, i) => {
    const x = 116 + i * 270;
    const y = 384 - i * 22;
    const h = 520 - y;
    const accent = i === 3 ? C.copper : C.teal;
    rect(slide, ctx, x, y, 220, h, i === 3 ? "#F5EEE6" : C.white, accent, 1, "investor-ladder");
    text(slide, ctx, `0${i + 1}`, x + 22, y + 22, 38, 20, { size: 13, color: accent, bold: true, face: "IBM Plex Sans" });
    text(slide, ctx, item[0], x + 64, y + 18, 126, 24, { size: 20, color: C.ink, bold: true });
    line(slide, ctx, x + 24, y + 58, 168, accent, 1);
    text(slide, ctx, item[1], x + 24, y + 72, 166, h - 98, { size: 13.2, color: C.gray });
  });

  text(slide, ctx, "万态网把 AI 的黑箱判断转化为工业现场可下单、可交付、可审计、可结算的 ODS 订单流量。", 140, 626, 930, 32, {
    size: 19,
    color: C.copper,
    bold: true,
    align: "center",
  });

  footer(slide, ctx, 16, "Business Plan V1.6 · 2026-06-02 · Confidential");
  return slide;
}
