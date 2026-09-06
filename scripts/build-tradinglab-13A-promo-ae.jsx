#target aftereffects

(function () {
  var ROOT = "C:/Users/brame/Desktop/Work/TradingLab/motion/13A-x-promo-2026-08-30";
  var ASSETS = ROOT + "/assets";
  var PROJECT_PATH = ROOT + "/project/TradingLab-13A-X-Promo.aep";
  var MASTER_RENDER = ROOT + "/renders/TradingLab-13A-X-4x5-1080x1350.mp4";
  var SQUARE_RENDER = ROOT + "/renders/TradingLab-13A-X-Square-1080x1080.mp4";
  var LOG_PATH = ROOT + "/qa/after-effects-build.log";

  var W = 1080;
  var H = 1350;
  var FPS = 30;
  var DURATION = 18;

  var INK = [7 / 255, 19 / 255, 36 / 255];
  var BLUE = [24 / 255, 90 / 255, 219 / 255];
  var PAPER = [247 / 255, 249 / 255, 252 / 255];
  var WHITE = [1, 1, 1];
  var SLATE = [104 / 255, 119 / 255, 141 / 255];

  var logLines = [];

  function log(value) {
    logLines.push(value);
  }

  function writeLog() {
    var file = new File(LOG_PATH);
    file.encoding = "UTF-8";
    file.open("w");
    file.write(logLines.join("\n") + "\n");
    file.close();
  }

  function transform(layer) {
    return layer.property("ADBE Transform Group");
  }

  function setOpacity(layer, value) {
    transform(layer).property("ADBE Opacity").setValue(value);
  }

  function setPosition(layer, value) {
    transform(layer).property("ADBE Position").setValue(value);
  }

  function setScale(layer, value) {
    transform(layer).property("ADBE Scale").setValue(value);
  }

  function easeProperty(prop, influence) {
    var keyIndex;
    var dimensions = 1;
    try {
      if (prop.value instanceof Array) dimensions = prop.value.length;
    } catch (ignored) {}
    for (keyIndex = 1; keyIndex <= prop.numKeys; keyIndex += 1) {
      var easeIn = [];
      var easeOut = [];
      var dimensionIndex;
      for (dimensionIndex = 0; dimensionIndex < dimensions; dimensionIndex += 1) {
        easeIn.push(new KeyframeEase(0, influence));
        easeOut.push(new KeyframeEase(0, influence));
      }
      try {
        prop.setTemporalEaseAtKey(keyIndex, easeIn, easeOut);
      } catch (ignoredEase) {}
    }
  }

  function keyframes(prop, times, values, influence) {
    var index;
    for (index = 0; index < times.length; index += 1) {
      prop.setValueAtTime(times[index], values[index]);
    }
    easeProperty(prop, influence || 72);
  }

  function setLayerRange(layer, start, end) {
    layer.startTime = start;
    layer.inPoint = start;
    layer.outPoint = end;
  }

  function addBackground(comp, name, color) {
    var layer = comp.layers.addSolid(color, name, comp.width, comp.height, 1, comp.duration);
    setLayerRange(layer, 0, comp.duration);
    layer.locked = true;
    return layer;
  }

  function addText(comp, name, text, fontSize, color, x, y, tracking, justification) {
    var layer = comp.layers.addText(text);
    layer.name = name;
    var source = layer.property("ADBE Text Properties").property("ADBE Text Document");
    var documentValue = source.value;
    documentValue.font = "Poppins-SemiBold";
    documentValue.fontSize = fontSize;
    documentValue.applyFill = true;
    documentValue.fillColor = color;
    documentValue.applyStroke = false;
    documentValue.tracking = tracking || 0;
    documentValue.autoLeading = false;
    documentValue.leading = fontSize * 0.98;
    documentValue.justification = justification || ParagraphJustification.CENTER_JUSTIFY;
    source.setValue(documentValue);
    try {
      var bounds = layer.sourceRectAtTime(0, false);
      transform(layer).property("ADBE Anchor Point").setValue([
        bounds.left + bounds.width / 2,
        bounds.top + bounds.height / 2
      ]);
    } catch (ignored) {}
    setPosition(layer, [x, y]);
    layer.motionBlur = true;
    return layer;
  }

  function addMonoText(comp, name, text, fontSize, color, x, y, tracking) {
    var layer = addText(comp, name, text, fontSize, color, x, y, tracking, ParagraphJustification.CENTER_JUSTIFY);
    var source = layer.property("ADBE Text Properties").property("ADBE Text Document");
    var documentValue = source.value;
    documentValue.font = "Poppins-Medium";
    source.setValue(documentValue);
    return layer;
  }

  function animateReveal(layer, start, holdEnd, end, offsetY, scaleStart) {
    var opacity = transform(layer).property("ADBE Opacity");
    var position = transform(layer).property("ADBE Position");
    var scale = transform(layer).property("ADBE Scale");
    var finalPosition = position.value;
    setLayerRange(layer, Math.max(0, start - 0.02), end + 0.02);
    keyframes(opacity, [start, start + 0.22, holdEnd, end], [0, 100, 100, 0], 74);
    keyframes(position, [start, start + 0.42, holdEnd, end], [
      [finalPosition[0], finalPosition[1] + offsetY],
      finalPosition,
      finalPosition,
      [finalPosition[0], finalPosition[1] - offsetY * 0.45]
    ], 76);
    keyframes(scale, [start, start + 0.34, start + 0.5, holdEnd, end], [
      [scaleStart, scaleStart],
      [103, 103],
      [100, 100],
      [100, 100],
      [96, 96]
    ], 78);
    try {
      var blur = layer.property("ADBE Effect Parade").addProperty("ADBE Box Blur2");
      var blurAmount = blur.property(1);
      keyframes(blurAmount, [start, start + 0.3, holdEnd, end], [24, 0, 0, 18], 70);
      blur.property(3).setValue(true);
    } catch (ignoredBlur) {}
  }

  function addShapeGroup(layer, groupName) {
    var root = layer.property("ADBE Root Vectors Group");
    var group = root.addProperty("ADBE Vector Group");
    group.name = groupName;
    return group.property("ADBE Vectors Group");
  }

  function addRoundedRect(comp, name, width, height, radius, color, x, y, opacity) {
    var layer = comp.layers.addShape();
    layer.name = name;
    var contents = addShapeGroup(layer, "Rectangle");
    var rect = contents.addProperty("ADBE Vector Shape - Rect");
    rect.property("ADBE Vector Rect Size").setValue([width, height]);
    rect.property("ADBE Vector Rect Roundness").setValue(radius);
    var fill = contents.addProperty("ADBE Vector Graphic - Fill");
    fill.property("ADBE Vector Fill Color").setValue(color);
    fill.property("ADBE Vector Fill Opacity").setValue(opacity === undefined ? 100 : opacity);
    setPosition(layer, [x, y]);
    layer.motionBlur = true;
    return layer;
  }

  function addEllipse(comp, name, width, height, color, x, y, opacity) {
    var layer = comp.layers.addShape();
    layer.name = name;
    var contents = addShapeGroup(layer, "Ellipse");
    var ellipse = contents.addProperty("ADBE Vector Shape - Ellipse");
    ellipse.property("ADBE Vector Ellipse Size").setValue([width, height]);
    var fill = contents.addProperty("ADBE Vector Graphic - Fill");
    fill.property("ADBE Vector Fill Color").setValue(color);
    fill.property("ADBE Vector Fill Opacity").setValue(opacity === undefined ? 100 : opacity);
    setPosition(layer, [x, y]);
    layer.motionBlur = true;
    return layer;
  }

  function addRing(comp, name, width, height, color, strokeWidth, x, y, opacity) {
    var layer = comp.layers.addShape();
    layer.name = name;
    var contents = addShapeGroup(layer, "Ring");
    var ellipse = contents.addProperty("ADBE Vector Shape - Ellipse");
    ellipse.property("ADBE Vector Ellipse Size").setValue([width, height]);
    var stroke = contents.addProperty("ADBE Vector Graphic - Stroke");
    stroke.property("ADBE Vector Stroke Color").setValue(color);
    stroke.property("ADBE Vector Stroke Width").setValue(strokeWidth);
    stroke.property("ADBE Vector Stroke Opacity").setValue(opacity);
    setPosition(layer, [x, y]);
    layer.motionBlur = true;
    return layer;
  }

  function addPath(comp, name, points, color, strokeWidth, opacity, closed, trimStart, trimEnd) {
    var layer = comp.layers.addShape();
    layer.name = name;
    var contents = addShapeGroup(layer, "Path");
    var pathGroup = contents.addProperty("ADBE Vector Shape - Group");
    var shape = new Shape();
    var inTangents = [];
    var outTangents = [];
    var index;
    for (index = 0; index < points.length; index += 1) {
      inTangents.push([0, 0]);
      outTangents.push([0, 0]);
    }
    shape.vertices = points;
    shape.inTangents = inTangents;
    shape.outTangents = outTangents;
    shape.closed = closed || false;
    pathGroup.property("ADBE Vector Shape").setValue(shape);
    var stroke = contents.addProperty("ADBE Vector Graphic - Stroke");
    stroke.property("ADBE Vector Stroke Color").setValue(color);
    stroke.property("ADBE Vector Stroke Width").setValue(strokeWidth);
    stroke.property("ADBE Vector Stroke Line Cap").setValue(2);
    stroke.property("ADBE Vector Stroke Line Join").setValue(2);
    stroke.property("ADBE Vector Stroke Opacity").setValue(opacity);
    if (trimStart !== undefined && trimEnd !== undefined) {
      var trim = contents.addProperty("ADBE Vector Filter - Trim");
      var endProperty = trim.property("ADBE Vector Trim End");
      keyframes(endProperty, [trimStart, trimEnd], [0, 100], 76);
    }
    setPosition(layer, [0, 0]);
    layer.motionBlur = true;
    return layer;
  }

  function addGrid(comp, color, opacity, spacing) {
    var layer = comp.layers.addShape();
    layer.name = "GRID / DATA FIELD";
    var x;
    var y;
    for (x = 0; x <= comp.width; x += spacing) {
      var vContents = addShapeGroup(layer, "V" + x);
      var vPath = vContents.addProperty("ADBE Vector Shape - Group");
      var vShape = new Shape();
      vShape.vertices = [[x, 120], [x, comp.height - 120]];
      vShape.inTangents = [[0, 0], [0, 0]];
      vShape.outTangents = [[0, 0], [0, 0]];
      vShape.closed = false;
      vPath.property("ADBE Vector Shape").setValue(vShape);
      var vStroke = vContents.addProperty("ADBE Vector Graphic - Stroke");
      vStroke.property("ADBE Vector Stroke Color").setValue(color);
      vStroke.property("ADBE Vector Stroke Width").setValue(1);
      vStroke.property("ADBE Vector Stroke Opacity").setValue(opacity);
    }
    for (y = 135; y <= comp.height - 120; y += spacing) {
      var hContents = addShapeGroup(layer, "H" + y);
      var hPath = hContents.addProperty("ADBE Vector Shape - Group");
      var hShape = new Shape();
      hShape.vertices = [[0, y], [comp.width, y]];
      hShape.inTangents = [[0, 0], [0, 0]];
      hShape.outTangents = [[0, 0], [0, 0]];
      hShape.closed = false;
      hPath.property("ADBE Vector Shape").setValue(hShape);
      var hStroke = hContents.addProperty("ADBE Vector Graphic - Stroke");
      hStroke.property("ADBE Vector Stroke Color").setValue(color);
      hStroke.property("ADBE Vector Stroke Width").setValue(1);
      hStroke.property("ADBE Vector Stroke Opacity").setValue(opacity);
    }
    setPosition(layer, [0, 0]);
    setOpacity(layer, 100);
    keyframes(transform(layer).property("ADBE Scale"), [0, comp.duration], [[104, 104], [100, 100]], 62);
    return layer;
  }

  function addPulseRings(comp, color, x, y, start, end, count, baseSize) {
    var index;
    for (index = 0; index < count; index += 1) {
      var ring = addRing(comp, "RIPPLE " + (index + 1), baseSize + index * 170, baseSize + index * 170, color, 12, x, y, 100);
      var localStart = start + index * 0.08;
      var opacity = transform(ring).property("ADBE Opacity");
      var scale = transform(ring).property("ADBE Scale");
      setLayerRange(ring, localStart, end);
      keyframes(opacity, [localStart, localStart + 0.16, end], [0, 28 - index * 3, 0], 70);
      keyframes(scale, [localStart, end], [[72, 72], [124, 124]], 72);
    }
  }

  function addNode(comp, name, x, y, color, start, delay) {
    var node = addEllipse(comp, name, 26, 26, color, x, y, 100);
    var opacity = transform(node).property("ADBE Opacity");
    var scale = transform(node).property("ADBE Scale");
    setLayerRange(node, start + delay, comp.duration);
    keyframes(opacity, [start + delay, start + delay + 0.12], [0, 100], 78);
    keyframes(scale, [start + delay, start + delay + 0.16, start + delay + 0.28], [[0, 0], [120, 120], [100, 100]], 78);
    return node;
  }

  function addDisclaimer(comp, color) {
    var layer = addText(
      comp,
      "LEGAL / DISCLAIMER",
      "SIMULACIÓN EDUCATIVA  ·  SALDO DEMO SIN VALOR MONETARIO  ·  NO ES ASESORAMIENTO FINANCIERO",
      18,
      color,
      W / 2,
      1148,
      24,
      ParagraphJustification.CENTER_JUSTIFY
    );
    setOpacity(layer, 62);
    setLayerRange(layer, 0, comp.duration);
    return layer;
  }

  function addCard(comp, name, x, y, width, height, color, strokeColor, start) {
    var card = addRoundedRect(comp, name + " / SURFACE", width, height, 34, color, x, y, 100);
    try {
      var contents = card.property("ADBE Root Vectors Group").property(1).property("ADBE Vectors Group");
      var stroke = contents.addProperty("ADBE Vector Graphic - Stroke");
      stroke.property("ADBE Vector Stroke Color").setValue(strokeColor);
      stroke.property("ADBE Vector Stroke Width").setValue(2);
      stroke.property("ADBE Vector Stroke Opacity").setValue(24);
    } catch (ignored) {}
    var opacity = transform(card).property("ADBE Opacity");
    var position = transform(card).property("ADBE Position");
    setLayerRange(card, start, comp.duration);
    keyframes(opacity, [start, start + 0.22], [0, 100], 76);
    keyframes(position, [start, start + 0.38], [[x, y + 54], [x, y]], 76);
    return card;
  }

  function importAsset(filePath, name, folder) {
    var file = new File(filePath);
    if (!file.exists) throw new Error("Missing asset: " + file.fsName);
    var options = new ImportOptions(file);
    var item = app.project.importFile(options);
    item.name = name;
    if (folder) item.parentFolder = folder;
    return item;
  }

  function addFootage(comp, item, name, x, y, scaleValue, start, end) {
    var layer = comp.layers.add(item);
    layer.name = name;
    setPosition(layer, [x, y]);
    setScale(layer, [scaleValue, scaleValue]);
    setLayerRange(layer, start, end);
    layer.motionBlur = true;
    try { layer.collapseTransformation = true; } catch (ignored) {}
    return layer;
  }

  function makeSceneFolder(rootFolder) {
    var folder = app.project.items.addFolder("02_SCENES");
    folder.parentFolder = rootFolder;
    return folder;
  }

  function makeComp(name, duration, folder) {
    var comp = app.project.items.addComp(name, W, H, 1, duration, FPS);
    comp.parentFolder = folder;
    comp.motionBlur = true;
    comp.shutterAngle = 210;
    comp.shutterPhase = -105;
    comp.bgColor = INK;
    return comp;
  }

  function scene01(folder) {
    var comp = makeComp("SC01_ANTES_DEL_CAPITAL", 3.6, folder);
    addBackground(comp, "BG / DEEP INK", INK);
    var glow = addEllipse(comp, "ATMOS / BLUE FIELD", 760, 760, BLUE, 540, 675, 10);
    setOpacity(glow, 12);
    try {
      var blur = glow.property("ADBE Effect Parade").addProperty("ADBE Box Blur2");
      blur.property(1).setValue(180);
      blur.property(3).setValue(true);
    } catch (ignoredGlow) {}
    addGrid(comp, PAPER, 12, 90);
    var fork = addPath(comp, "DECISION TRACE", [[250, 760], [420, 655], [540, 530], [660, 655], [830, 760]], BLUE, 7, 100, false, 0.18, 1.48);
    setOpacity(fork, 88);
    addNode(comp, "EVIDENCE NODE", 540, 530, PAPER, 0, 1.12);
    addPulseRings(comp, BLUE, 540, 530, 1.08, 2.22, 3, 70);
    var eyebrow = addText(comp, "TYPE / BEFORE CAPITAL", "ANTES DEL CAPITAL,", 38, PAPER, 540, 320, 120);
    animateReveal(eyebrow, 0.28, 1.54, 1.82, 32, 92);
    var lineOne = addText(comp, "TYPE / GOES THE", "VA EL", 72, PAPER, 540, 715, 40);
    animateReveal(lineOne, 1.52, 3.26, 3.5, 56, 88);
    var criterion = addText(comp, "TYPE / CRITERION", "CRITERIO.", 112, BLUE, 540, 825, -18);
    animateReveal(criterion, 1.66, 3.28, 3.52, 68, 84);
    var coord1 = addMonoText(comp, "DATA / COORD 01", "EVIDENCE  01", 18, SLATE, 235, 470, 80);
    animateReveal(coord1, 0.72, 2.9, 3.25, 18, 94);
    var coord2 = addMonoText(comp, "DATA / COORD 02", "HYPOTHESIS  02", 18, SLATE, 845, 885, 80);
    animateReveal(coord2, 0.92, 2.98, 3.3, 18, 94);
    addDisclaimer(comp, PAPER);
    return comp;
  }

  function scene02(folder) {
    var comp = makeComp("SC02_APRENDE", 2.4, folder);
    addBackground(comp, "BG / PAPER", PAPER);
    addGrid(comp, INK, 7, 96);
    var step = addMonoText(comp, "STEP / 01", "01 / APRENDIZAJE", 20, BLUE, 540, 245, 110);
    animateReveal(step, 0.08, 2.06, 2.34, 24, 90);
    var title = addText(comp, "TYPE / APRENDE", "APRENDE.", 118, INK, 540, 395, -24);
    animateReveal(title, 0.12, 2.04, 2.34, 58, 84);
    var sub = addText(comp, "TYPE / SUB", "Estructura · riesgo · contexto", 34, SLATE, 540, 505, 12);
    animateReveal(sub, 0.32, 2.02, 2.32, 28, 92);
    var xs = [250, 540, 830];
    var labels = ["ESTRUCTURA", "RIESGO", "CONTEXTO"];
    var index;
    for (index = 0; index < 3; index += 1) {
      var start = 0.48 + index * 0.14;
      addCard(comp, "CARD / " + labels[index], xs[index], 765, 248, 176, WHITE, INK, start);
      var number = addMonoText(comp, "CARD / NUMBER " + (index + 1), "0" + (index + 1), 24, BLUE, xs[index], 714, 80);
      animateReveal(number, start + 0.1, 2.06, 2.3, 22, 88);
      var label = addText(comp, "CARD / LABEL " + (index + 1), labels[index], 22, INK, xs[index], 790, 64);
      animateReveal(label, start + 0.16, 2.06, 2.3, 24, 88);
      addNode(comp, "CARD / NODE " + (index + 1), xs[index], 855, index === 1 ? BLUE : INK, start, 0.22);
    }
    var connector = addPath(comp, "LEARNING CONNECTOR", [[250, 930], [540, 930], [830, 930]], BLUE, 5, 100, false, 0.68, 1.72);
    setOpacity(connector, 66);
    addDisclaimer(comp, INK);
    return comp;
  }

  function scene03(folder) {
    var comp = makeComp("SC03_PRACTICA", 2.4, folder);
    addBackground(comp, "BG / DEEP INK", INK);
    addGrid(comp, PAPER, 9, 90);
    var step = addMonoText(comp, "STEP / 02", "02 / MODO PRÁCTICA", 20, BLUE, 540, 230, 110);
    animateReveal(step, 0.08, 2.05, 2.34, 24, 90);
    var title = addText(comp, "TYPE / PRACTICA", "PRACTICA.", 112, PAPER, 540, 382, -20);
    animateReveal(title, 0.1, 2.04, 2.34, 62, 84);
    var sub = addText(comp, "TYPE / SUB", "Sin poner capital en juego.", 34, SLATE, 540, 492, 10);
    animateReveal(sub, 0.28, 2.02, 2.32, 34, 92);
    var pill = addRoundedRect(comp, "PILL / DEMO", 310, 86, 43, BLUE, 540, 650, 100);
    var pillOpacity = transform(pill).property("ADBE Opacity");
    var pillScale = transform(pill).property("ADBE Scale");
    keyframes(pillOpacity, [0.42, 0.64, 2.06, 2.3], [0, 100, 100, 0], 76);
    keyframes(pillScale, [0.42, 0.68, 0.84], [[76, 76], [106, 106], [100, 100]], 78);
    var pillText = addText(comp, "PILL / LABEL", "SALDO DEMO", 26, PAPER, 540, 650, 88);
    animateReveal(pillText, 0.54, 2.04, 2.3, 20, 90);
    var path1 = addPath(comp, "TRACE / PASS 01", [[185, 900], [345, 820], [520, 930], [710, 770], [900, 855]], PAPER, 3, 30, false, 0.42, 1.24);
    var path2 = addPath(comp, "TRACE / PASS 02", [[185, 935], [345, 855], [520, 965], [710, 805], [900, 890]], BLUE, 5, 62, false, 0.58, 1.48);
    var path3 = addPath(comp, "TRACE / PASS 03", [[185, 970], [345, 890], [520, 1000], [710, 840], [900, 925]], PAPER, 3, 92, false, 0.74, 1.72);
    setOpacity(path1, 30);
    setOpacity(path2, 74);
    setOpacity(path3, 52);
    addDisclaimer(comp, PAPER);
    return comp;
  }

  function scene04(folder) {
    var comp = makeComp("SC04_VALIDA", 2.4, folder);
    addBackground(comp, "BG / PAPER", PAPER);
    addGrid(comp, INK, 7, 96);
    var step = addMonoText(comp, "STEP / 03", "03 / VALIDACIÓN", 20, BLUE, 540, 218, 110);
    animateReveal(step, 0.08, 2.05, 2.34, 24, 90);
    var title = addText(comp, "TYPE / VALIDA", "VALIDA.", 112, INK, 540, 365, -20);
    animateReveal(title, 0.1, 2.04, 2.34, 62, 84);
    var diamond = addPath(comp, "EVIDENCE DIAMOND", [[540, 545], [675, 680], [540, 815], [405, 680], [540, 545]], BLUE, 8, 100, false, 0.28, 1.3);
    addPulseRings(comp, BLUE, 540, 680, 0.9, 1.92, 3, 165);
    var origins = [[220, 680], [540, 980], [860, 680]];
    var destinations = [[405, 680], [540, 815], [675, 680]];
    var index;
    for (index = 0; index < 3; index += 1) {
      var node = addEllipse(comp, "VALIDATION NODE " + (index + 1), 32, 32, index === 1 ? BLUE : INK, origins[index][0], origins[index][1], 100);
      var pos = transform(node).property("ADBE Position");
      var opacity = transform(node).property("ADBE Opacity");
      var start = 0.34 + index * 0.12;
      keyframes(opacity, [start, start + 0.12, 1.86, 2.18], [0, 100, 100, 0], 76);
      keyframes(pos, [start, 1.18 + index * 0.1], [origins[index], destinations[index]], 78);
    }
    var badgeLabels = ["REPITE", "MIDE", "AJUSTA"];
    var badgeXs = [290, 540, 790];
    for (index = 0; index < 3; index += 1) {
      var badge = addRoundedRect(comp, "BADGE / " + badgeLabels[index], 210, 62, 31, index === 1 ? BLUE : INK, badgeXs[index], 980, 100);
      var badgeOpacity = transform(badge).property("ADBE Opacity");
      var badgeScale = transform(badge).property("ADBE Scale");
      var badgeStart = 1.02 + index * 0.15;
      keyframes(badgeOpacity, [badgeStart, badgeStart + 0.18, 2.06, 2.3], [0, 100, 100, 0], 76);
      keyframes(badgeScale, [badgeStart, badgeStart + 0.18, badgeStart + 0.3], [[80, 80], [106, 106], [100, 100]], 78);
      var badgeText = addText(comp, "BADGE / LABEL " + (index + 1), badgeLabels[index], 19, PAPER, badgeXs[index], 980, 78);
      animateReveal(badgeText, badgeStart + 0.06, 2.04, 2.28, 16, 90);
    }
    addDisclaimer(comp, INK);
    return comp;
  }

  function scene05(folder, assetFolder) {
    var comp = makeComp("SC05_PROCESO_LOGO", 3.6, folder);
    addBackground(comp, "BG / DEEP INK", INK);
    addGrid(comp, PAPER, 8, 90);
    addPulseRings(comp, BLUE, 540, 675, 1.06, 3.44, 5, 150);
    var firstLine = addText(comp, "TYPE / FIRST", "PRIMERO,", 62, PAPER, 540, 530, 70);
    animateReveal(firstLine, 0.06, 1.06, 1.28, 46, 88);
    var secondLine = addText(comp, "TYPE / PROCESS", "EL PROCESO.", 106, BLUE, 540, 650, -18);
    animateReveal(secondLine, 0.18, 1.08, 1.32, 64, 84);
    var upperItem = importAsset(ASSETS + "/logo/tradinglab-plane-upper-2048.png", "LOGO 13A / UPPER INK", assetFolder);
    var lowerItem = importAsset(ASSETS + "/logo/tradinglab-plane-lower-2048.png", "LOGO 13A / LOWER BLUE", assetFolder);
    var upper = addFootage(comp, upperItem, "LOGO / TOP INK", 540, 675, 46, 1.12, 3.6);
    var lower = addFootage(comp, lowerItem, "LOGO / BOTTOM BLUE", 540, 675, 46, 1.12, 3.6);
    var upperPos = transform(upper).property("ADBE Position");
    var lowerPos = transform(lower).property("ADBE Position");
    var upperRot = transform(upper).property("ADBE Rotate Z");
    var lowerRot = transform(lower).property("ADBE Rotate Z");
    var upperScale = transform(upper).property("ADBE Scale");
    var lowerScale = transform(lower).property("ADBE Scale");
    var upperOpacity = transform(upper).property("ADBE Opacity");
    var lowerOpacity = transform(lower).property("ADBE Opacity");
    keyframes(upperOpacity, [1.12, 1.34], [0, 100], 76);
    keyframes(lowerOpacity, [1.22, 1.48], [0, 100], 76);
    keyframes(upperPos, [1.12, 2.18, 2.42], [[380, 500], [552, 666], [540, 675]], 82);
    keyframes(lowerPos, [1.22, 2.24, 2.48], [[700, 850], [528, 684], [540, 675]], 82);
    keyframes(upperRot, [1.12, 2.2, 2.46], [-9, 1.2, 0], 82);
    keyframes(lowerRot, [1.22, 2.26, 2.52], [9, -1.2, 0], 82);
    keyframes(upperScale, [1.12, 2.14, 2.4], [[54, 54], [45, 45], [46, 46]], 82);
    keyframes(lowerScale, [1.22, 2.2, 2.46], [[54, 54], [45, 45], [46, 46]], 82);
    var lock = addRoundedRect(comp, "VALIDATION / LOCK PILL", 360, 68, 34, PAPER, 540, 1010, 100);
    var lockOpacity = transform(lock).property("ADBE Opacity");
    var lockScale = transform(lock).property("ADBE Scale");
    keyframes(lockOpacity, [2.38, 2.62, 3.38, 3.56], [0, 100, 100, 0], 76);
    keyframes(lockScale, [2.38, 2.64, 2.8], [[72, 72], [105, 105], [100, 100]], 80);
    var lockLabel = addMonoText(comp, "VALIDATION / LABEL", "CRITERIO VALIDADO", 18, INK, 540, 1010, 84);
    animateReveal(lockLabel, 2.48, 3.34, 3.56, 18, 92);
    addDisclaimer(comp, PAPER);
    return comp;
  }

  function scene06(folder, assetFolder) {
    var comp = makeComp("SC06_END_CARD", 3.6, folder);
    addBackground(comp, "BG / PAPER", PAPER);
    addPulseRings(comp, BLUE, 540, 675, 0, 3.55, 6, 220);
    var after = addText(comp, "TYPE / AFTER", "DESPUÉS,", 56, INK, 540, 430, 90);
    animateReveal(after, 0.02, 1.3, 1.56, 36, 90);
    var operate = addText(comp, "TYPE / OPERATE", "OPERA EN", 86, INK, 540, 570, -8);
    animateReveal(operate, 0.12, 1.32, 1.56, 54, 86);
    var real = addText(comp, "TYPE / REAL", "REAL.", 122, BLUE, 540, 690, -24);
    animateReveal(real, 0.24, 1.32, 1.58, 66, 84);
    var lockupItem = importAsset(ASSETS + "/logo/tradinglab-lockup-horizontal-2500.png", "LOCKUP 13A / POSITIVE", assetFolder);
    var lockup = addFootage(comp, lockupItem, "END / TRADINGLAB LOCKUP", 540, 575, 28, 1.42, 3.6);
    var lockOpacity = transform(lockup).property("ADBE Opacity");
    var lockScale = transform(lockup).property("ADBE Scale");
    keyframes(lockOpacity, [1.42, 1.72], [0, 100], 78);
    keyframes(lockScale, [1.42, 1.72, 1.92], [[22, 22], [30, 30], [28, 28]], 82);
    var tagline = addText(comp, "END / TAGLINE", "Aprende. Practica. Luego opera en real.", 32, INK, 540, 770, 8);
    animateReveal(tagline, 1.62, 3.58, 3.6, 28, 92);
    var cta = addRoundedRect(comp, "END / CTA PILL", 488, 82, 41, BLUE, 540, 912, 100);
    var ctaOpacity = transform(cta).property("ADBE Opacity");
    var ctaScale = transform(cta).property("ADBE Scale");
    keyframes(ctaOpacity, [1.82, 2.08], [0, 100], 78);
    keyframes(ctaScale, [1.82, 2.1, 2.3], [[78, 78], [104, 104], [100, 100]], 82);
    var ctaText = addText(comp, "END / CTA LABEL", "ABRIR SIMULADOR DEMO  →", 24, PAPER, 540, 912, 62);
    animateReveal(ctaText, 1.96, 3.58, 3.6, 18, 92);
    addDisclaimer(comp, INK);
    return comp;
  }

  function addTransition(comp, name, time, color) {
    var layer = addEllipse(comp, name, 1500, 1500, color, 540, 675, 100);
    var opacity = transform(layer).property("ADBE Opacity");
    var scale = transform(layer).property("ADBE Scale");
    setLayerRange(layer, time - 0.14, time + 0.12);
    keyframes(scale, [time - 0.14, time + 0.025], [[0, 0], [142, 142]], 82);
    keyframes(opacity, [time - 0.14, time + 0.025, time + 0.11], [100, 100, 0], 74);
    return layer;
  }

  function addNoiseOverlay(comp) {
    var layer = comp.layers.addSolid([0.5, 0.5, 0.5], "GRADE / SUBTLE GRAIN", comp.width, comp.height, 1, comp.duration);
    setOpacity(layer, 12);
    try {
      layer.blendingMode = BlendingMode.SOFT_LIGHT;
      var noise = layer.property("ADBE Effect Parade").addProperty("ADBE Noise");
      noise.property(1).setValue(4.5);
      try { noise.property(2).setValue(false); } catch (ignoredMono) {}
    } catch (error) {
      layer.remove();
      return null;
    }
    return layer;
  }

  function addMarker(comp, time, label, comment) {
    var marker = new MarkerValue(label);
    marker.comment = comment || "";
    comp.markerProperty.setValueAtTime(time, marker);
  }

  function chooseH264Template(outputModule) {
    var templates = outputModule.templates;
    var index;
    for (index = 0; index < templates.length; index += 1) {
      if (templates[index].indexOf("H.264") >= 0 && templates[index].indexOf("15") >= 0) {
        outputModule.applyTemplate(templates[index]);
        return templates[index];
      }
    }
    for (index = 0; index < templates.length; index += 1) {
      if (templates[index].indexOf("H.264") >= 0 && templates[index].indexOf("5") >= 0) {
        outputModule.applyTemplate(templates[index]);
        return templates[index];
      }
    }
    return "DEFAULT";
  }

  function queueComp(comp, outputPath) {
    var item = app.project.renderQueue.items.add(comp);
    var templates = item.templates;
    var index;
    for (index = 0; index < templates.length; index += 1) {
      if (templates[index].indexOf("óptima") >= 0 || templates[index].indexOf("Best") >= 0) {
        item.applyTemplate(templates[index]);
        break;
      }
    }
    var module = item.outputModule(1);
    var templateName = chooseH264Template(module);
    module.file = new File(outputPath);
    log("Queue: " + comp.name + " -> " + outputPath + " | " + templateName);
    return item;
  }

  function build() {
    if (!app.project) app.newProject();
    if (app.project.numItems !== 0) {
      var activePath = app.project.file ? app.project.file.fsName.toLowerCase() : "";
      var expectedPath = new File(PROJECT_PATH).fsName.toLowerCase();
      if (activePath === expectedPath) {
        app.project.close(CloseOptions.DO_NOT_SAVE_CHANGES);
        app.newProject();
      } else {
        throw new Error("The active After Effects project is not empty. Build stopped to preserve existing work.");
      }
    }

    app.beginUndoGroup("Build TradingLab 13A X Promo");
    app.project.bitsPerChannel = 16;

    var rootFolder = app.project.items.addFolder("TRADINGLAB_13A_X_PROMO");
    var assetFolder = app.project.items.addFolder("01_ASSETS");
    assetFolder.parentFolder = rootFolder;
    var sceneFolder = makeSceneFolder(rootFolder);
    var masterFolder = app.project.items.addFolder("03_MASTERS");
    masterFolder.parentFolder = rootFolder;

    var musicItem = importAsset(ASSETS + "/audio/tradinglab-music-bed-100bpm.wav", "AUDIO / MUSIC BED 100 BPM", assetFolder);
    var sfxItem = importAsset(ASSETS + "/audio/tradinglab-sound-design.wav", "AUDIO / SOUND DESIGN", assetFolder);

    var scenes = [
      scene01(sceneFolder),
      scene02(sceneFolder),
      scene03(sceneFolder),
      scene04(sceneFolder),
      scene05(sceneFolder, assetFolder),
      scene06(sceneFolder, assetFolder)
    ];
    var starts = [0, 3.6, 6.0, 8.4, 10.8, 14.4];

    var master = app.project.items.addComp("TL_X_13A_MASTER_4x5_1080x1350_18s", W, H, 1, DURATION, FPS);
    master.parentFolder = masterFolder;
    master.motionBlur = true;
    master.shutterAngle = 210;
    master.shutterPhase = -105;
    master.bgColor = INK;

    var index;
    for (index = 0; index < scenes.length; index += 1) {
      var sceneLayer = master.layers.add(scenes[index]);
      sceneLayer.name = "SCENE " + (index + 1) + " / " + scenes[index].name;
      sceneLayer.startTime = starts[index];
      sceneLayer.inPoint = starts[index];
      sceneLayer.outPoint = starts[index] + scenes[index].duration;
      sceneLayer.motionBlur = true;
    }

    addTransition(master, "TRANSITION / 01 PAPER", 3.6, PAPER);
    addTransition(master, "TRANSITION / 02 INK", 6.0, INK);
    addTransition(master, "TRANSITION / 03 PAPER", 8.4, PAPER);
    addTransition(master, "TRANSITION / 04 INK", 10.8, INK);
    addTransition(master, "TRANSITION / 05 PAPER", 14.4, PAPER);

    var musicLayer = master.layers.add(musicItem);
    musicLayer.name = "AUDIO / MUSIC BED";
    setLayerRange(musicLayer, 0, DURATION);
    var sfxLayer = master.layers.add(sfxItem);
    sfxLayer.name = "AUDIO / SOUND DESIGN";
    setLayerRange(sfxLayer, 0, DURATION);
    try {
      transform(musicLayer).property("ADBE Audio Levels").setValue([-7, -7]);
      transform(sfxLayer).property("ADBE Audio Levels").setValue([-3, -3]);
    } catch (ignoredAudio) {}

    addNoiseOverlay(master);
    addMarker(master, 0, "HOOK", "Antes del capital");
    addMarker(master, 3.6, "APRENDE", "Estructura · riesgo · contexto");
    addMarker(master, 6.0, "PRACTICA", "Saldo DEMO");
    addMarker(master, 8.4, "VALIDA", "Repite · mide · ajusta");
    addMarker(master, 10.8, "PROCESO", "Primero, el proceso");
    addMarker(master, 14.4, "REAL", "Después, opera en real");
    addMarker(master, 16.2, "END CARD", "TradingLab");

    var square = app.project.items.addComp("TL_X_13A_SQUARE_1080x1080_18s", 1080, 1080, 1, DURATION, FPS);
    square.parentFolder = masterFolder;
    square.motionBlur = true;
    square.shutterAngle = 210;
    square.shutterPhase = -105;
    var squareLayer = square.layers.add(master);
    squareLayer.name = "MASTER 4x5 / SAFE CENTER CROP";
    setPosition(squareLayer, [540, 540]);
    setLayerRange(squareLayer, 0, DURATION);
    addMarker(square, 0, "SAFE CROP", "1080x1080 version for X");

    var controller = master.layers.addNull(DURATION);
    controller.name = "00_CTRL / MASTER SETTINGS";
    controller.label = 9;
    try {
      var intensity = controller.property("ADBE Effect Parade").addProperty("ADBE Slider Control");
      intensity.name = "Motion intensity";
      intensity.property(1).setValue(100);
      var grain = controller.property("ADBE Effect Parade").addProperty("ADBE Slider Control");
      grain.name = "Grain amount";
      grain.property(1).setValue(4.5);
    } catch (ignoredControls) {}

    queueComp(master, MASTER_RENDER);
    queueComp(square, SQUARE_RENDER);

    app.project.save(new File(PROJECT_PATH));
    master.openInViewer();
    app.endUndoGroup();

    log("Status: OK");
    log("After Effects: " + app.version);
    log("Project: " + PROJECT_PATH);
    log("Master: " + master.name + " | " + master.width + "x" + master.height + " | " + master.duration + "s | " + master.frameRate + "fps");
    log("Square: " + square.name + " | " + square.width + "x" + square.height + " | " + square.duration + "s | " + square.frameRate + "fps");
    log("Items: " + app.project.numItems);
    log("Generated: " + new Date().toUTCString());
  }

  try {
    build();
  } catch (error) {
    log("Status: ERROR");
    log(error.toString());
    if (error.line) log("Line: " + error.line);
    try { app.endUndoGroup(); } catch (ignoredUndo) {}
  }
  writeLog();
}());
