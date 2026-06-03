import { bg, C, footer, kicker, note, rect, text, titleBox } from "./common.mjs";

export async function slide10(presentation, ctx) {
  const slide = presentation.slides.add();
  bg(slide, ctx);
  kicker(slide, ctx, "PRODUCT TO REVENUE", "10", C.steel);
  titleBox(slide, ctx, "PIC、DE、V1N 的价值，\n在于把平台能力转换成可计费服务。", 76, 88, 860, 106, 38);
  note(slide, ctx, "投资人需要看到的不是功能堆叠，而是平台能力如何变成可售服务、计费单位和收入来源。", 214, 830);

  const x = 86;
  const y = 286;
  const widths = [210, 285, 270, 270];
  const headers = ["平台能力", "可售服务", "计费单位", "收入来源"];
  let cx = x;
  headers.forEach((h, i) => {
    rect(slide, ctx, cx, y, widths[i], 42, i === 0 ? C.steel : C.teal, "none", 0, "bridge-header");
    text(slide, ctx, h, cx + 18, y + 12, widths[i] - 26, 18, { size: 15, color: C.white, bold: true });
    cx += widths[i];
  });

  const rows = [
    ["PIC 现场节点", "工位接入、运维、审计服务", "节点 / 场景 / 月服务", "PIC 节点收入"],
    ["DE 数字员工", "质检、包装、巡检、物流等岗位服务", "数字员工部署 / 月服务费", "DE 数字员工收入"],
    ["V1N 软件工人", "任务单元、异常分支、审计字段服务包", "服务包授权 / 调用次数", "V1N 服务包收入"],
    ["ODS 订单交付", "订单生成、派工、验收、审计、结算", "订单 / 工单 / 渠道分成", "ODS 交付收入"],
    ["行业应用包", "场景模板、部署、升级和运维", "应用包授权 / 复制部署", "应用包与持续服务收入"],
  ];

  rows.forEach((row, r) => {
    cx = x;
    const top = y + 42 + r * 66;
    row.forEach((cell, i) => {
      const accent = r === 3 ? C.teal : r === 4 ? C.copper : C.line;
      const fill = r === 3 ? "#EAF4F3" : C.white;
      rect(slide, ctx, cx, top, widths[i], 62, fill, accent, 1, "bridge-cell");
      text(slide, ctx, cell, cx + 16, top + 18, widths[i] - 28, 28, {
        size: i === 0 || i === 3 ? 15.5 : 13.5,
        color: i === 0 ? C.ink : i === 3 ? (r === 3 ? C.teal : C.copper) : C.gray,
        bold: i === 0 || i === 3,
        align: i === 3 ? "center" : "left",
      });
      cx += widths[i];
    });
  });

  text(slide, ctx, "商业转换链路：平台能力不是成本中心，而是可被采购、调用、结算和复制的服务商品。", 166, 646, 860, 28, {
    size: 17,
    color: C.copper,
    bold: true,
    align: "center",
  });

  footer(slide, ctx, 10);
  return slide;
}
