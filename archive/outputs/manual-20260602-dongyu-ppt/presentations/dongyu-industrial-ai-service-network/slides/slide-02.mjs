import { bg, C, F, footer, kicker, line, note, rect, text, titleBox } from "./common.mjs";

export async function slide02(presentation, ctx) {
  const slide = presentation.slides.add();
  bg(slide, ctx);
  kicker(slide, ctx, "INVESTMENT CONCLUSION", "02", C.copper);
  titleBox(slide, ctx, "第一阶段资金形成的是渠道资产，\n不是单点试点费用。", 76, 92, 760, 104, 38);
  note(slide, ctx, "投资进入后形成的核心不是一个工厂项目，而是 AI 进入工业服务的业务网络、订单交付流量、现场节点和区域复制位置。", 198, 780);

  rect(slide, ctx, 82, 318, 270, 150, C.white, C.copper, 1, "capital-box");
  text(slide, ctx, "第一阶段规划投资", 108, 346, 180, 22, { size: 16, color: C.gray, bold: true });
  text(slide, ctx, "5,000 万元", 106, 374, 210, 54, { size: 43, color: C.copper, bold: true, face: F.latin });
  text(slide, ctx, "进入联合项目公司", 108, 430, 180, 24, { size: 17, color: C.ink, bold: true });

  line(slide, ctx, 352, 392, 118, C.copper, 2);
  text(slide, ctx, "形成", 396, 366, 54, 20, { size: 13, color: C.copper, bold: true, align: "center" });

  const assets = [
    ["01", "业务网络", "可演示、可部署、可运维的工业业务网络。", C.steel],
    ["02", "ODS 订单资产", "需求、订单、任务、交付、验收和审计记录形成标准资产。", C.teal],
    ["03", "现场边界", "现场智脑、智慧模型、权限、安全和执行确认。", C.teal],
    ["04", "现场节点", "PIC、DE 数字员工、V1N 软件工人服务包。", C.steel],
    ["05", "区域样板", "合肥首批样板、客户池、园区窗口和渠道伙伴。", C.copper],
    ["06", "资本接力", "形成产业基金、战略客户和区域平台合作基础。", C.copper],
  ];

  const startX = 492;
  const startY = 304;
  const rowH = 60;
  line(slide, ctx, startX + 16, startY + 30, 520, C.line, 1);
  assets.forEach((asset, i) => {
    const y = startY + i * rowH;
    line(slide, ctx, startX + 16, y + 30, 22, asset[3], 2);
    text(slide, ctx, `${asset[0]}  ${asset[1]}`, startX, y + 10, 178, 22, { size: 18, color: C.ink, bold: true });
    text(slide, ctx, asset[2], startX + 58, y + 36, 470, 24, { size: 13.5, color: C.gray });
    if (i < assets.length - 1) {
      line(slide, ctx, startX + 38, y + 52, 500, C.line, 1);
    }
  });

  footer(slide, ctx, 2);
  return slide;
}
