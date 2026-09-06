#target aftereffects

(function () {
  var outputRoot = "C:/Users/brame/Desktop/Work/TradingLab/motion/13A-x-promo-2026-08-30/qa/frames";
  var logPath = "C:/Users/brame/Desktop/Work/TradingLab/motion/13A-x-promo-2026-08-30/qa/frame-export.log";
  var folder = new Folder(outputRoot);
  if (!folder.exists) folder.create();
  var comp = null;
  var squareComp = null;
  var index;
  for (index = 1; index <= app.project.numItems; index += 1) {
    var item = app.project.item(index);
    if (item instanceof CompItem && item.name === "TL_X_13A_MASTER_4x5_1080x1350_18s") {
      comp = item;
    }
    if (item instanceof CompItem && item.name === "TL_X_13A_SQUARE_1080x1080_18s") {
      squareComp = item;
    }
  }
  var lines = [];
  if (!comp) {
    lines.push("ERROR: master comp not found");
  } else {
    var times = [0.6, 2.2, 4.8, 7.2, 9.6, 10.2, 12.6, 13.6, 15.15, 17.1];
    for (index = 0; index < times.length; index += 1) {
      var time = times[index];
      var fileName = "frame-" + (index + 1) + "-" + String(time).replace(".", "_") + "s.png";
      var file = new File(outputRoot + "/" + fileName);
      comp.saveFrameToPng(time, file);
      lines.push(file.fsName + " | " + time + "s");
    }
    if (squareComp) {
      var squareFile = new File(outputRoot + "/square-final-17_1s.png");
      squareComp.saveFrameToPng(17.1, squareFile);
      lines.push(squareFile.fsName + " | square 17.1s");
    }
  }
  var log = new File(logPath);
  log.encoding = "UTF-8";
  log.open("w");
  log.write(lines.join("\n") + "\n");
  log.close();
}());
