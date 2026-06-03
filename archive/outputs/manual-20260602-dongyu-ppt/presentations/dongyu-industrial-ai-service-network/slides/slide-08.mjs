import { bg, C, footer, kicker, line, note, rect, text, titleBox } from "./common.mjs";

export async function slide08(presentation, ctx) {
  const slide = presentation.slides.add();
  bg(slide, ctx);
  kicker(slide, ctx, "SITE BRAIN", "08", C.teal);
  titleBox(slide, ctx, "黑箱负责智能生成，\n白箱负责工业落地。", 76, 88, 760, 106, 38);
  note(slide, ctx, "万态网体系作为 AI 底座，不替代大语言模型，而是用模型化技术把模型意图转成可验证、可执行、可审计的现场操作。", 214, 940);

  rect(slide, ctx, 92, 296, 300, 246, C.white, C.line, 1, "cloud-column");
  text(slide, ctx, "黑箱 AI", 122, 328, 200, 30, { size: 26, color: C.ink, bold: true });
  text(slide, ctx, "负责", 122, 378, 60, 20, { size: 13, color: C.gray, bold: true });
  text(slide, ctx, "需求理解\n自然语言交互\n方案生成\n异常解释\n跨场景知识复用", 122, 408, 210, 112, { size: 16.5, color: C.gray });

  rect(slide, ctx, 882, 296, 300, 246, C.white, C.teal, 1, "site-column");
  text(slide, ctx, "工业现场", 912, 328, 200, 30, { size: 26, color: C.ink, bold: true });
  text(slide, ctx, "负责", 912, 378, 60, 20, { size: 13, color: C.gray, bold: true });
  text(slide, ctx, "设备与工位\n机器人与人员\n质量责任\n安全边界\n交付验收", 912, 408, 210, 112, { size: 16.5, color: C.gray });

  rect(slide, ctx, 482, 268, 298, 266, C.white, C.copper, 1, "control-boundary");
  text(slide, ctx, "万态网白箱底座", 512, 300, 220, 30, { size: 25, color: C.ink, bold: true, align: "center" });
  const items = [
    ["ModelTable", "订单、流程、权限、审计字段"],
    ["智慧模型", "工艺规则、参数范围、异常分支"],
    ["现场智脑", "现场状态、权限、安全裁决"],
    ["ODS 账本", "订单、交付、验收、结算"],
  ];
  items.forEach((item, i) => {
    const y = 358 + i * 42;
    line(slide, ctx, 522, y + 28, 218, C.line, 1);
    text(slide, ctx, item[0], 518, y, 96, 20, { size: 15, color: i === 0 ? C.copper : C.ink, bold: true });
    text(slide, ctx, item[1], 626, y + 1, 136, 30, { size: 12, color: C.gray });
  });

  line(slide, ctx, 392, 406, 90, C.copper, 2);
  line(slide, ctx, 780, 406, 102, C.teal, 2);
  text(slide, ctx, "意图", 422, 374, 40, 18, { size: 12, color: C.copper, bold: true, align: "center" });
  text(slide, ctx, "ODS 交付任务", 790, 374, 96, 18, { size: 12, color: C.teal, bold: true, align: "center" });

  footer(slide, ctx, 8);
  return slide;
}
