import { bg, C, footer, kicker, line, note, rect, text, titleBox } from "./common.mjs";

export async function slide04(presentation, ctx) {
  const slide = presentation.slides.add();
  bg(slide, ctx);
  kicker(slide, ctx, "CHANNEL GAP", "04", C.teal);
  titleBox(slide, ctx, "工业 AI 的机会很大，\n困难在黑箱不能直接进入现场。", 76, 88, 900, 110, 38);
  note(slide, ctx, "工业现场不是信息空间：一次错误动作会触碰质量、设备、安全、节拍和责任边界，因此大模型意图必须先进入白箱底座。", 210, 900);

  const top = 300;
  rect(slide, ctx, 86, top, 236, 152, C.white, C.line, 1, "cloud-box");
  text(slide, ctx, "黑箱 AI", 112, top + 28, 184, 28, { size: 24, color: C.ink, bold: true, align: "center" });
  text(slide, ctx, "大语言模型\n理解需求\n生成方案\n解释异常", 116, top + 64, 176, 72, { size: 14.8, color: C.gray, align: "center" });

  rect(slide, ctx, 964, top, 236, 152, C.white, C.line, 1, "factory-box");
  text(slide, ctx, "工业现场服务", 992, top + 30, 178, 28, { size: 24, color: C.ink, bold: true, align: "center" });
  text(slide, ctx, "工位 / 设备 / 机器人\n人员确认 / 质量责任\n执行记录", 984, top + 68, 198, 66, { size: 15.5, color: C.gray, align: "center" });

  line(slide, ctx, 322, top + 70, 92, C.line, 2);
  line(slide, ctx, 870, top + 70, 94, C.line, 2);
  text(slide, ctx, "不能直接越过", 356, top + 34, 96, 20, { size: 12, color: C.red, bold: true, align: "center" });
  text(slide, ctx, "安全 / 质量 / 责任边界", 862, top + 34, 120, 20, { size: 12, color: C.red, bold: true, align: "center" });

  rect(slide, ctx, 430, 260, 418, 254, C.white, C.teal, 1, "wantai-channel");
  rect(slide, ctx, 430, 260, 418, 7, C.teal, "none", 0, "channel-top");
  text(slide, ctx, "万态网白箱底座", 462, 286, 230, 30, { size: 26, color: C.ink, bold: true });
  text(slide, ctx, "模型化技术把意图变成可审计操作", 464, 322, 300, 24, { size: 18, color: C.teal, bold: true });

  const lanes = [
    ["01 模型化表达", "ModelTable 描述订单、工位、权限、流程和审计字段", C.steel],
    ["02 白箱裁决", "智慧模型校验，现场智脑裁决权限、安全和执行确认", C.teal],
    ["03 交付账本", "订单、派工、执行、验收和异常形成账本与结算依据", C.copper],
  ];
  lanes.forEach((lane, i) => {
    const y = 372 + i * 44;
    line(slide, ctx, 462, y + 34, 350, C.line, 1);
    text(slide, ctx, lane[0], 462, y, 112, 20, { size: 14, color: lane[2], bold: true });
    text(slide, ctx, lane[1], 590, y, 236, 34, { size: 12.5, color: C.gray });
  });

  text(slide, ctx, "ODS 订单交付系统", 486, 530, 314, 30, { size: 24, color: C.teal, bold: true, align: "center" });
  text(slide, ctx, "可下单 · 可交付 · 可审计 · 可结算", 506, 566, 274, 22, { size: 16, color: C.gray, align: "center" });

  footer(slide, ctx, 4, "Context: Siemens Industrial Copilot, Schneider EcoStruxure; project source: BP V1.6");
  return slide;
}
