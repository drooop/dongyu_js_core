import { bg, C, footer, kicker, note, rect, text, titleBox } from "./common.mjs";

export async function slide15(presentation, ctx) {
  const slide = presentation.slides.add();
  bg(slide, ctx);
  kicker(slide, ctx, "FIRST-STAGE ASSETS", "15", C.copper);
  titleBox(slide, ctx, "5,000 万元形成六类\n可尽调、可展示、可复制资产。", 76, 88, 820, 106, 38);
  note(slide, ctx, "资金进入联合项目公司，用于工种落地、现场智能、基本工位、简单生产集成和首批 ODS 订单交付系统建设。", 214, 880);

  rect(slide, ctx, 94, 300, 246, 166, C.white, C.copper, 1, "fund-box");
  text(slide, ctx, "第一阶段规划投资", 124, 334, 170, 22, { size: 16, color: C.gray, bold: true });
  text(slide, ctx, "5,000 万元", 124, 370, 180, 44, { size: 34, color: C.copper, bold: true, face: "IBM Plex Sans" });
  text(slide, ctx, "资金进入联合项目公司", 124, 426, 172, 22, { size: 16, color: C.ink, bold: true });

  const assets = [
    ["业务网络资产", "万态网业务网络可演示、可部署、可运维"],
    ["ODS 订单资产", "订单、交付、验收、审计和结算记录"],
    ["现场智脑资产", "现场状态、权限、安全和执行确认能力"],
    ["PIC / DE / V1N 资产", "现场节点、数字岗位和任务单元"],
    ["样板项目资产", "主样板、备选样板、客户确认和运行报告"],
    ["区域运营资产", "合肥示范中心、产业客户池和渠道伙伴"],
  ];

  assets.forEach((a, i) => {
    const col = i % 2;
    const row = Math.floor(i / 2);
    const x = 420 + col * 315;
    const y = 286 + row * 100;
    const accent = i === 1 ? C.teal : i >= 4 ? C.copper : C.steel;
    rect(slide, ctx, x, y, 284, 84, C.white, C.line, 1, "asset-box");
    rect(slide, ctx, x, y, 4, 84, accent, "none", 0, "asset-accent");
    text(slide, ctx, a[0], x + 20, y + 14, 210, 20, { size: 17, color: C.ink, bold: true });
    text(slide, ctx, a[1], x + 20, y + 40, 236, 32, { size: 12.3, color: C.gray });
  });

  footer(slide, ctx, 15);
  return slide;
}
