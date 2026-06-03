import { bg, C, footer, kicker, line, note, rect, text, titleBox } from "./common.mjs";

export async function slide05(presentation, ctx) {
  const slide = presentation.slides.add();
  bg(slide, ctx);
  kicker(slide, ctx, "BUSINESS NETWORK", "05", C.teal);
  titleBox(slide, ctx, "万态网不是系统工具，\n而是 AI 到工业服务的业务网络。", 76, 88, 760, 106, 38);
  note(slide, ctx, "万态网把工厂、工位、劳务工种、服务商、PIC、DE、V1N、现场智脑和云端大模型组织成同一条业务渠道。", 214, 860);

  const x = 96;
  const y = 292;
  const width = 1020;
  const rowH = 78;
  const rows = [
    ["节点层", "工厂", "工位", "劳务工种", "设备 / 机器人", "服务商", C.steel],
    ["服务层", "需求入口", "订单目录", "ODS 交付", "工位服务包", "行业应用包", C.teal],
    ["执行层", "现场智脑", "智慧模型", "PIC 节点", "DE 数字员工", "V1N 软件工人", C.teal],
    ["经营层", "审计账本", "结算规则", "渠道分成", "客户复购", "区域复制", C.copper],
  ];

  rows.forEach((row, r) => {
    const top = y + r * rowH;
    rect(slide, ctx, x, top, width, rowH - 6, r === 1 ? "#EAF4F3" : C.white, row[6], 1, "network-layer");
    rect(slide, ctx, x, top, 6, rowH - 6, row[6], "none", 0, "layer-accent");
    text(slide, ctx, row[0], x + 26, top + 22, 96, 26, { size: 22, color: row[6], bold: true });
    for (let i = 1; i <= 5; i += 1) {
      const nodeX = x + 176 + (i - 1) * 158;
      text(slide, ctx, row[i], nodeX, top + 22, 128, 24, { size: 16, color: C.ink, bold: r === 1 && i === 3, align: "center" });
      if (r < rows.length - 1) {
        rect(slide, ctx, nodeX + 64, top + 54, 1, 28, row[6], "none", 0, "layer-link");
      }
    }
  });

  line(slide, ctx, 226, 618, 706, C.teal, 2);
  text(slide, ctx, "业务网络的价值：需求可进入，服务可发现，执行可控制，结果可审计，流量可结算。", 246, 632, 720, 26, {
    size: 17,
    color: C.teal,
    bold: true,
    align: "center",
  });

  footer(slide, ctx, 5);
  return slide;
}
