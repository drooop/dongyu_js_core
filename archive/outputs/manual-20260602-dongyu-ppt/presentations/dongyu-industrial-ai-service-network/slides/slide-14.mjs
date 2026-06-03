import { bg, C, footer, kicker, note, rect, text, titleBox } from "./common.mjs";

export async function slide14(presentation, ctx) {
  const slide = presentation.slides.add();
  bg(slide, ctx);
  kicker(slide, ctx, "BUSINESS MODEL", "14", C.teal);
  titleBox(slide, ctx, "收入从项目交付升级为 ODS 订单交付、\n节点、数字员工和渠道分成。", 76, 88, 980, 106, 38);
  note(slide, ctx, "首期通过样板项目和服务包交付取得收入，中长期通过 ODS 订单交付、平台订阅、渠道分成和生态交易形成持续收入。", 214, 930);

  const x = 86;
  const y = 286;
  const widths = [230, 360, 320];
  const headers = ["收入类型", "收入内容", "商业作用"];
  let cx = x;
  headers.forEach((h, i) => {
    rect(slide, ctx, cx, y, widths[i], 42, C.steel, "none", 0, "revenue-header");
    text(slide, ctx, h, cx + 18, y + 12, widths[i] - 28, 18, { size: 15, color: C.white, bold: true });
    cx += widths[i];
  });

  const rows = [
    ["ODS 订单交付收入", "按订单、工单、验收结果和渠道分成计费", "工业服务交易的核心收入"],
    ["PIC 节点收入", "PIC 节点销售、租赁或服务化交付", "每个工位的标准入口"],
    ["DE 数字员工收入", "数字员工部署、岗位服务费、持续运维", "客户可理解的岗位化服务"],
    ["渠道运营收入", "劳务市场、园区、设备商、集成商导入订单后的服务分成", "销售订单交付流量的渠道收益"],
    ["行业应用包收入", "应用包授权、部署、升级、运维", "形成行业复制能力"],
  ];
  rows.forEach((row, r) => {
    cx = x;
    const top = y + 42 + r * 62;
    row.forEach((cell, i) => {
      const fill = r === 0 ? "#EAF4F3" : C.white;
      const stroke = r === 0 ? C.teal : C.line;
      rect(slide, ctx, cx, top, widths[i], 58, fill, stroke, 1, "revenue-cell");
      text(slide, ctx, cell, cx + 18, top + 10, widths[i] - 30, 34, {
        size: i === 0 ? 15.5 : 13.5,
        color: r === 0 && i === 0 ? C.teal : C.ink,
        bold: i === 0,
      });
      cx += widths[i];
    });
  });

  footer(slide, ctx, 14);
  return slide;
}
