(function () {
  var output = new File("C:/Users/brame/Desktop/Work/TradingLab/motion/13A-x-promo-2026-08-30/qa/after-effects-probe.txt");
  var lines = [];
  lines.push("After Effects " + app.version);
  lines.push("Build " + app.buildName);
  app.beginUndoGroup("TradingLab probe");
  var probeComp = app.project.items.addComp("__TL_PROBE__", 64, 64, 1, 1, 30);
  var rq = app.project.renderQueue.items.add(probeComp);
  var om = rq.outputModule(1);
  lines.push("Render templates: " + rq.templates.join(" | "));
  lines.push("Output templates: " + om.templates.join(" | "));
  try {
    lines.push("Default output settings: " + om.getSettings(GetSettingsFormat.STRING_SETTABLE).toSource());
  } catch (error) {
    lines.push("Default output settings unavailable: " + error.toString());
  }
  rq.remove();
  probeComp.remove();
  app.endUndoGroup();
  output.encoding = "UTF-8";
  output.open("w");
  output.write(lines.join("\n"));
  output.close();
}());
