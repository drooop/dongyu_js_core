import { bg, C, footer, kicker, line, note, rect, text, titleBox } from "./common.mjs";

export async function slide11(presentation, ctx) {
  const slide = presentation.slides.add();
  bg(slide, ctx);
  kicker(slide, ctx, "JOINT STRUCTURE", "11", C.steel);
  titleBox(slide, ctx, "上海洞宇建平台，\n合肥洞宇建场景和区域复制入口。", 76, 88, 880, 106, 38);
  note(slide, ctx, "联合项目公司承接资金、合同、样板资产、区域运营和后续融资权益，形成“上海平台研发 + 合肥场景落地”的双中心结构。", 214, 900);

  rect(slide, ctx, 92, 286, 360, 264, C.white, C.steel, 1, "shanghai");
  text(slide, ctx, "上海洞宇", 124, 320, 180, 40, { size: 27, color: C.ink, bold: true });
  text(slide, ctx, "平台技术方 / 标准建设方", 124, 360, 210, 22, { size: 16, color: C.steel, bold: true });
  text(slide, ctx, "万态网业务网络\nODS 订单交付标准\nModelTable 与智慧模型\n现场智脑与 AI Agent 接口\nPIC / DE / V1N 产品体系", 124, 404, 260, 116, { size: 16, color: C.gray });

  rect(slide, ctx, 796, 286, 360, 264, C.white, C.teal, 1, "hefei");
  text(slide, ctx, "合肥洞宇", 828, 320, 180, 40, { size: 27, color: C.ink, bold: true });
  text(slide, ctx, "应用场景方 / 区域运营方", 828, 360, 230, 22, { size: 16, color: C.teal, bold: true });
  text(slide, ctx, "工厂场景与机器人落地\n帮立及劳务工种入口\n客户运营与项目交付\n政府、园区、产业基金对接\n行业应用包与区域复制", 828, 404, 270, 116, { size: 16, color: C.gray });

  rect(slide, ctx, 516, 330, 206, 172, "#F5EEE6", C.copper, 1, "jv");
  text(slide, ctx, "联合项目公司", 544, 360, 152, 26, { size: 22, color: C.ink, bold: true, align: "center" });
  text(slide, ctx, "承接资金\n承接合同\n承接样板资产\n承接区域运营", 558, 406, 120, 78, { size: 15, color: C.gray, align: "center" });

  line(slide, ctx, 452, 404, 64, C.copper, 2);
  line(slide, ctx, 722, 404, 74, C.copper, 2);
  text(slide, ctx, "授权与产品", 456, 376, 78, 18, { size: 12, color: C.copper, bold: true, align: "center" });
  text(slide, ctx, "场景与运营", 736, 376, 86, 18, { size: 12, color: C.copper, bold: true, align: "center" });

  footer(slide, ctx, 11);
  return slide;
}
