import { bg, C, footer, kicker, line, note, rect, text, titleBox } from "./common.mjs";

export async function slide07(presentation, ctx) {
  const slide = presentation.slides.add();
  bg(slide, ctx);
  kicker(slide, ctx, "OPERATING LOOP", "07", C.teal);
  titleBox(slide, ctx, "万态网把需求、订单、交付、验收和结算\n组织成可销售流量。", 76, 88, 920, 106, 38);
  note(slide, ctx, "渠道不是一条销售线索，而是一套让工业服务可以下单、派工、执行、验收、审计和计费的业务网络。", 214, 850);

  const steps = [
    ["01", "需求进入", "客户 / 工厂系统 / 劳务市场 / AI Agent"],
    ["02", "订单生成", "服务目录、价格、时限和验收口径"],
    ["03", "交付校验", "调用方、工位边界、安全条件"],
    ["04", "任务派发", "订单拆成现场可执行任务"],
    ["05", "现场执行", "PIC 连接现场，DE/V1N 执行任务"],
    ["06", "结果回写", "结果、异常、责任人和运行数据"],
    ["07", "审计复盘", "操作账本、服务包和结算依据"],
  ];

  line(slide, ctx, 96, 365, 1010, C.teal, 2);
  steps.forEach((step, i) => {
    const x = 96 + i * 168;
    const accent = i >= 5 ? C.copper : C.teal;
    rect(slide, ctx, x, 356, 18, 18, accent, "none", 0, "loop-node");
    text(slide, ctx, step[0], x - 8, 316, 48, 18, { size: 12, color: accent, bold: true, face: "IBM Plex Sans", align: "center" });
    text(slide, ctx, step[1], x - 26, 390, 86, 24, { size: 17, color: C.ink, bold: true, align: "center" });
    text(slide, ctx, step[2], x - 48, 426, 130, 54, { size: 12.5, color: C.gray, align: "center" });
  });

  rect(slide, ctx, 338, 548, 464, 58, "#EAF4F3", C.teal, 1, "loop-result");
  text(slide, ctx, "每笔订单形成 ODS 交付记录，可用于运营、计费、审计和渠道分成。", 366, 560, 410, 42, { size: 16.5, color: C.teal, bold: true, align: "center" });

  footer(slide, ctx, 7);
  return slide;
}
