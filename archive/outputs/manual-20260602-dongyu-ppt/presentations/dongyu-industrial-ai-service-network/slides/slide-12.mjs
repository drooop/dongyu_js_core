import { bg, C, footer, kicker, line, note, rect, text, titleBox } from "./common.mjs";

export async function slide12(presentation, ctx) {
  const slide = presentation.slides.add();
  bg(slide, ctx);
  kicker(slide, ctx, "FIRST STAGE LANDING", "12", C.teal);
  titleBox(slide, ctx, "首期从劳务工种和基本工位切入，\n避开未确认具体工位的过度承诺。", 76, 88, 960, 106, 38);
  note(slide, ctx, "第一阶段以帮立及其他劳务市场中的工种落地为入口，建立现场智能和基本工位，形成简单工位生产集成方式。", 214, 900);

  const steps = [
    ["01", "帮立及劳务市场", "包装、分拣、搬运、巡检、质检、上下料等工种来源"],
    ["02", "工种服务化", "把人能做的工种定义成服务目录、验收口径和审计字段"],
    ["03", "现场智能", "现场智脑、扫码、称重、视觉、人员确认和异常回退"],
    ["04", "基本工位", "PIC 接入、DE 岗位职责、V1N 任务单元和简单生产集成"],
    ["05", "ODS 交付", "每笔订单形成任务、结果、验收和审计记录"],
  ];

  line(slide, ctx, 110, 382, 960, C.teal, 2);
  steps.forEach((step, i) => {
    const x = 110 + i * 240;
    const accent = i === 4 ? C.copper : C.teal;
    rect(slide, ctx, x, 372, 20, 20, accent, "none", 0, "landing-node");
    text(slide, ctx, step[0], x - 12, 330, 46, 18, { size: 12, color: accent, bold: true, align: "center" });
    text(slide, ctx, step[1], x - 52, 414, 126, 24, { size: 18, color: C.ink, bold: true, align: "center" });
    text(slide, ctx, step[2], x - 80, 456, 184, 74, { size: 13.5, color: C.gray, align: "center" });
  });

  rect(slide, ctx, 260, 570, 620, 54, "#EAF4F3", C.teal, 1, "landing-result");
  text(slide, ctx, "阶段结果：形成主样板、备选样板和可复制行业应用包。", 304, 586, 532, 24, {
    size: 18,
    color: C.teal,
    bold: true,
    align: "center",
  });

  footer(slide, ctx, 12);
  return slide;
}
