import { bg, C, footer, kicker, line, note, rect, text, titleBox } from "./common.mjs";

export async function slide13(presentation, ctx) {
  const slide = presentation.slides.add();
  bg(slide, ctx);
  kicker(slide, ctx, "FOUR-STAGE ROUTE", "13", C.copper);
  titleBox(slide, ctx, "项目从工种样板走向智能生产线、\n渠道运营和工业业务网络生态。", 76, 88, 920, 106, 38);
  note(slide, ctx, "外部材料只呈现第一阶段投资安排；后续阶段以专项融资、平台化融资和生态扩张融资承接，不写具体金额。", 214, 880);

  const stages = [
    ["第一阶段", "工种与基本工位落地", "帮立及劳务市场工种落地；建立现场智能、基本工位与简单生产集成。", "本轮融资重点", C.copper],
    ["第二阶段", "云端大模型与智能生产线", "引入云端大模型；形成智能现场生产线与完整安装服务体系。", "后续专项融资", C.teal],
    ["第三阶段", "渠道和订单流量运营", "建设渠道运营、ODS 订单交付销售、结算与区域复制系统。", "后续平台化融资", C.teal],
    ["第四阶段", "工业业务网络生态", "形成跨区域、跨行业、跨服务商的工业业务网络与服务市场。", "后续生态扩张融资", C.steel],
  ];

  line(slide, ctx, 120, 358, 950, C.line, 2);
  stages.forEach((s, i) => {
    const x = 110 + i * 274;
    rect(slide, ctx, x, 336, 28, 28, s[4], "none", 0, "stage-dot");
    text(slide, ctx, s[0], x - 28, 292, 84, 20, { size: 14, color: s[4], bold: true, align: "center" });
    rect(slide, ctx, x - 30, 384, 230, 196, C.white, s[4], 1, "stage-box");
    text(slide, ctx, s[1], x - 6, 408, 178, 48, { size: 18, color: C.ink, bold: true });
    text(slide, ctx, s[2], x - 6, 462, 178, 66, { size: 13.2, color: C.gray });
    text(slide, ctx, s[3], x - 6, 536, 170, 24, { size: 13, color: s[4], bold: true });
  });

  footer(slide, ctx, 13);
  return slide;
}
