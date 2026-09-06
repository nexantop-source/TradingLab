#target aftereffects

(function () {
  var ROOT = "C:/Users/brame/Desktop/Work/TradingLab/motion/13A-google-motion-v2-2026-08-30";
  var V1_ROOT = "C:/Users/brame/Desktop/Work/TradingLab/motion/13A-x-promo-2026-08-30";
  var ASSETS = V1_ROOT + "/assets";
  var PROJECT_PATH = ROOT + "/project/TradingLab-13A-Google-Motion-V2.aep";
  var V1_PROJECT_PATH = V1_ROOT + "/project/TradingLab-13A-X-Promo.aep";
  var MASTER_RENDER = ROOT + "/renders/TradingLab-13A-Google-Motion-V2-4x5.mp4";
  var SQUARE_RENDER = ROOT + "/renders/TradingLab-13A-Google-Motion-V2-Square.mp4";
  var LOG_PATH = ROOT + "/qa/after-effects-build-v2.log";

  var W = 1080;
  var H = 1350;
  var FPS = 30;
  var DURATION = 18;

  var INK = [7 / 255, 19 / 255, 36 / 255];
  var BLUE = [24 / 255, 90 / 255, 219 / 255];
  var PAPER = [247 / 255, 249 / 255, 252 / 255];
  var WHITE = [1, 1, 1];
  var SOFT_BLUE = [102 / 255, 151 / 255, 245 / 255];
  var PALE_BLUE = [220 / 255, 231 / 255, 252 / 255];
  var SLATE = [93 / 255, 111 / 255, 136 / 255];

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

  function setRange(layer, start, end) {
    layer.startTime = Math.max(0, start);
    layer.inPoint = Math.max(0, start);
    layer.outPoint = Math.min(DURATION, end);
  }

  function setPosition(layer, value) {
    transform(layer).property("ADBE Position").setValue(value);
  }

  function setScale(layer, value) {
    transform(layer).property("ADBE Scale").setValue(value);
  }

  function setOpacity(layer, value) {
    transform(layer).property("ADBE Opacity").setValue(value);
  }

  function setRotation(layer, value) {
    transform(layer).property("ADBE Rotate Z").setValue(value);
  }

  function propertyDimensions(prop) {
    var dimensions = 1;
    try {
      if (prop.value instanceof Array) dimensions = prop.value.length;
    } catch (ignored) {}
    return dimensions;
  }

  function applyAsymmetricEase(prop, easeInInfluence, easeOutInfluence) {
    var dimensions = propertyDimensions(prop);
    var keyIndex;
    for (keyIndex = 1; keyIndex <= prop.numKeys; keyIndex += 1) {
      var easeIn = [];
      var easeOut = [];
      var dimensionIndex;
      for (dimensionIndex = 0; dimensionIndex < dimensions; dimensionIndex += 1) {
        easeIn.push(new KeyframeEase(0, easeInInfluence));
        easeOut.push(new KeyframeEase(0, easeOutInfluence));
      }
      try {
        prop.setTemporalEaseAtKey(keyIndex, easeIn, easeOut);
      } catch (ignoredEase) {}
    }
  }

  function keyframes(prop, times, values, easeInInfluence, easeOutInfluence) {
    var index;
    for (index = 0; index < times.length; index += 1) {
      prop.setValueAtTime(times[index], values[index]);
    }
    applyAsymmetricEase(prop, easeInInfluence || 82, easeOutInfluence || 34);
  }

  function addShapeGroup(layer, groupName) {
    var root = layer.property("ADBE Root Vectors Group");
    var group = root.addProperty("ADBE Vector Group");
    group.name = groupName;
    return group.property("ADBE Vectors Group");
  }

  function roundedShape(width, height, radius) {
    var w = width / 2;
    var h = height / 2;
    var r = Math.min(radius, w, h);
    var k = 0.5522847498;
    var shape = new Shape();
    shape.vertices = [
      [-w + r, -h],
      [w - r, -h],
      [w, -h + r],
      [w, h - r],
      [w - r, h],
      [-w + r, h],
      [-w, h - r],
      [-w, -h + r]
    ];
    shape.inTangents = [
      [-k * r, 0], [0, 0], [0, -k * r], [0, 0],
      [k * r, 0], [0, 0], [0, k * r], [0, 0]
    ];
    shape.outTangents = [
      [0, 0], [k * r, 0], [0, 0], [0, k * r],
      [0, 0], [-k * r, 0], [0, 0], [0, -k * r]
    ];
    shape.closed = true;
    return shape;
  }

  function diamondShape(width, height) {
    var shape = new Shape();
    shape.vertices = [[0, -height / 2], [width / 2, 0], [0, height / 2], [-width / 2, 0]];
    shape.inTangents = [[0, 0], [0, 0], [0, 0], [0, 0]];
    shape.outTangents = [[0, 0], [0, 0], [0, 0], [0, 0]];
    shape.closed = true;
    return shape;
  }

  function smoothShape(points, closed, tension) {
    var shape = new Shape();
    var inTangents = [];
    var outTangents = [];
    var index;
    var count = points.length;
    var amount = tension === undefined ? 0.18 : tension;
    for (index = 0; index < count; index += 1) {
      var previous = points[index === 0 ? (closed ? count - 1 : 0) : index - 1];
      var next = points[index === count - 1 ? (closed ? 0 : count - 1) : index + 1];
      var dx = (next[0] - previous[0]) * amount;
      var dy = (next[1] - previous[1]) * amount;
      inTangents.push([-dx, -dy]);
      outTangents.push([dx, dy]);
    }
    if (!closed) {
      inTangents[0] = [0, 0];
      outTangents[count - 1] = [0, 0];
    }
    shape.vertices = points;
    shape.inTangents = inTangents;
    shape.outTangents = outTangents;
    shape.closed = closed || false;
    return shape;
  }

  function addBackground(comp) {
    var layer = comp.layers.addSolid(PAPER, "BG / PAPER FOUNDATION", W, H, 1, DURATION);
    setRange(layer, 0, DURATION);
    layer.locked = true;
    return layer;
  }

  function addEllipse(comp, name, width, height, color, x, y, opacity) {
    var layer = comp.layers.addShape();
    layer.name = name;
    var contents = addShapeGroup(layer, "ELLIPSE");
    var ellipse = contents.addProperty("ADBE Vector Shape - Ellipse");
    ellipse.property("ADBE Vector Ellipse Size").setValue([width, height]);
    var fill = contents.addProperty("ADBE Vector Graphic - Fill");
    fill.property("ADBE Vector Fill Color").setValue(color);
    fill.property("ADBE Vector Fill Opacity").setValue(opacity === undefined ? 100 : opacity);
    setPosition(layer, [x, y]);
    layer.motionBlur = true;
    return layer;
  }

  function addRoundedRect(comp, name, width, height, radius, color, x, y, opacity) {
    var layer = comp.layers.addShape();
    layer.name = name;
    var contents = addShapeGroup(layer, "SURFACE");
    var path = contents.addProperty("ADBE Vector Shape - Group");
    path.property("ADBE Vector Shape").setValue(roundedShape(width, height, radius));
    var fill = contents.addProperty("ADBE Vector Graphic - Fill");
    fill.property("ADBE Vector Fill Color").setValue(color);
    fill.property("ADBE Vector Fill Opacity").setValue(opacity === undefined ? 100 : opacity);
    setPosition(layer, [x, y]);
    layer.motionBlur = true;
    return layer;
  }

  function addDiamond(comp, name, width, height, color, x, y, opacity) {
    var layer = comp.layers.addShape();
    layer.name = name;
    var contents = addShapeGroup(layer, "DIAMOND");
    var path = contents.addProperty("ADBE Vector Shape - Group");
    path.property("ADBE Vector Shape").setValue(diamondShape(width, height));
    var fill = contents.addProperty("ADBE Vector Graphic - Fill");
    fill.property("ADBE Vector Fill Color").setValue(color);
    fill.property("ADBE Vector Fill Opacity").setValue(opacity === undefined ? 100 : opacity);
    setPosition(layer, [x, y]);
    layer.motionBlur = true;
    return layer;
  }

  function addText(comp, name, text, fontSize, color, x, y, tracking, fontName, justification) {
    var layer = comp.layers.addText(text);
    layer.name = name;
    var source = layer.property("ADBE Text Properties").property("ADBE Text Document");
    var value = source.value;
    value.font = fontName || "Poppins-Bold";
    value.fontSize = fontSize;
    value.applyFill = true;
    value.fillColor = color;
    value.applyStroke = false;
    value.tracking = tracking || 0;
    value.autoLeading = false;
    value.leading = fontSize * 0.96;
    value.justification = justification || ParagraphJustification.CENTER_JUSTIFY;
    source.setValue(value);
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

  function animateMaterialText(layer, start, holdEnd, end, offsetY, initialScale) {
    var opacity = transform(layer).property("ADBE Opacity");
    var position = transform(layer).property("ADBE Position");
    var scale = transform(layer).property("ADBE Scale");
    var finalPosition = position.value;
    setRange(layer, Math.max(0, start - 0.03), end + 0.03);
    keyframes(opacity, [start, start + 0.12, holdEnd, end], [0, 100, 100, 0], 72, 28);
    keyframes(position, [start, start + 0.36, start + 0.52, holdEnd, end], [
      [finalPosition[0], finalPosition[1] + offsetY],
      [finalPosition[0], finalPosition[1] - offsetY * 0.08],
      finalPosition,
      finalPosition,
      [finalPosition[0], finalPosition[1] - offsetY * 0.4]
    ], 88, 28);
    keyframes(scale, [start, start + 0.3, start + 0.44, start + 0.58, holdEnd, end], [
      [initialScale, initialScale], [108, 108], [98, 98], [100, 100], [100, 100], [94, 94]
    ], 88, 24);
    try {
      var blur = layer.property("ADBE Effect Parade").addProperty("ADBE Box Blur2");
      keyframes(blur.property(1), [start, start + 0.3, holdEnd, end], [22, 0, 0, 16], 76, 32);
      blur.property(3).setValue(true);
    } catch (ignoredBlur) {}
  }

  function addInkSweep(comp) {
    var sweep = addEllipse(comp, "BG / INK CONTAINER TRANSFORM", 2050, 2050, INK, 940, 1190, 100);
    setRange(sweep, 2.78, 9.95);
    var scale = transform(sweep).property("ADBE Scale");
    keyframes(scale, [2.78, 2.9, 3.7, 3.92, 9.1, 9.6], [
      [0, 0], [6, 6], [165, 165], [160, 160], [160, 160], [176, 176]
    ], 90, 24);
    return sweep;
  }

  function addPaperSweep(comp) {
    var sweep = addEllipse(comp, "BG / PAPER CONTAINER TRANSFORM", 2120, 2120, PAPER, 120, 690, 100);
    setRange(sweep, 8.92, DURATION);
    var scale = transform(sweep).property("ADBE Scale");
    keyframes(scale, [8.92, 9.08, 9.82, 10.02], [[0, 0], [5, 5], [146, 146], [140, 140]], 90, 24);
    return sweep;
  }

  function addAmbientField(comp) {
    var glowOne = addEllipse(comp, "ATMOS / BLUE BREATH 01", 620, 620, BLUE, 130, 180, 100);
    setRange(glowOne, 0, DURATION);
    setOpacity(glowOne, 10);
    keyframes(transform(glowOne).property("ADBE Position"), [0, 8.5, 18], [[130, 180], [260, 290], [110, 210]], 72, 38);
    keyframes(transform(glowOne).property("ADBE Scale"), [0, 9, 18], [[86, 86], [118, 118], [92, 92]], 72, 38);
    try {
      var blurOne = glowOne.property("ADBE Effect Parade").addProperty("ADBE Box Blur2");
      blurOne.property(1).setValue(170);
      blurOne.property(3).setValue(true);
    } catch (ignoredOne) {}

    var glowTwo = addEllipse(comp, "ATMOS / BLUE BREATH 02", 780, 780, SOFT_BLUE, 950, 1120, 100);
    setRange(glowTwo, 9.2, DURATION);
    setOpacity(glowTwo, 11);
    keyframes(transform(glowTwo).property("ADBE Position"), [9.2, 14, 18], [[950, 1120], [820, 980], [930, 1040]], 72, 38);
    try {
      var blurTwo = glowTwo.property("ADBE Effect Parade").addProperty("ADBE Box Blur2");
      blurTwo.property(1).setValue(190);
      blurTwo.property(3).setValue(true);
    } catch (ignoredTwo) {}
  }

  function addMorphSurface(comp) {
    var shadow = comp.layers.addShape();
    shadow.name = "MATERIAL / DELAYED SHADOW";
    var shadowContents = addShapeGroup(shadow, "MORPH SHADOW");
    shadowContents.addProperty("ADBE Vector Shape - Group");
    shadowContents.addProperty("ADBE Vector Graphic - Fill");
    var shadowPath = shadowContents.property(1).property("ADBE Vector Shape");
    var shadowFill = shadowContents.property(2);
    shadowFill.property("ADBE Vector Fill Color").setValue(INK);
    shadowFill.property("ADBE Vector Fill Opacity").setValue(24);
    setPosition(shadow, [540, 696]);
    setRange(shadow, 3.02, 12.18);
    setOpacity(shadow, 48);
    try {
      var shadowBlur = shadow.property("ADBE Effect Parade").addProperty("ADBE Box Blur2");
      shadowBlur.property(1).setValue(48);
      shadowBlur.property(3).setValue(true);
    } catch (ignoredShadow) {}

    var surface = comp.layers.addShape();
    surface.name = "MATERIAL / ONE LIVING SURFACE";
    var contents = addShapeGroup(surface, "MORPH SURFACE");
    contents.addProperty("ADBE Vector Shape - Group");
    contents.addProperty("ADBE Vector Graphic - Fill");
    var path = contents.property(1).property("ADBE Vector Shape");
    var fill = contents.property(2);
    var color = fill.property("ADBE Vector Fill Color");
    fill.property("ADBE Vector Fill Opacity").setValue(100);
    setPosition(surface, [540, 675]);
    setRange(surface, 3.02, 12.18);
    surface.motionBlur = true;

    var times = [3.02, 3.16, 3.72, 5.42, 5.86, 6.34, 8.84, 9.24, 9.82, 11.12, 11.72, 12.12];
    var shapes = [
      diamondShape(46, 46),
      roundedShape(90, 90, 45),
      roundedShape(930, 350, 175),
      roundedShape(850, 320, 160),
      roundedShape(760, 270, 135),
      roundedShape(860, 560, 230),
      roundedShape(830, 540, 210),
      roundedShape(700, 620, 270),
      roundedShape(560, 560, 280),
      roundedShape(510, 510, 255),
      roundedShape(210, 210, 105),
      diamondShape(64, 64)
    ];
    var colors = [BLUE, BLUE, BLUE, BLUE, BLUE, BLUE, BLUE, BLUE, INK, INK, BLUE, BLUE];
    var index;
    for (index = 0; index < times.length; index += 1) {
      path.setValueAtTime(times[index], shapes[index]);
      shadowPath.setValueAtTime(times[index] + 0.055, shapes[index]);
      color.setValueAtTime(times[index], colors[index]);
    }
    applyAsymmetricEase(path, 90, 22);
    applyAsymmetricEase(shadowPath, 86, 28);
    applyAsymmetricEase(color, 78, 32);
    keyframes(transform(surface).property("ADBE Scale"), [3.02, 3.22, 3.4, 3.64, 5.65, 5.92, 6.22, 6.46, 9.06, 9.3, 9.55, 11.5, 11.75, 12.12], [
      [0, 0], [112, 112], [97, 97], [100, 100], [100, 100], [94, 106], [105, 96], [100, 100], [100, 100], [108, 94], [100, 100], [100, 100], [112, 112], [100, 100]
    ], 90, 24);
    return surface;
  }

  function addRipple(comp, name, x, y, start, end, color, maxSize, opacity) {
    var layer = comp.layers.addShape();
    layer.name = name;
    var contents = addShapeGroup(layer, "RIPPLE");
    var ellipse = contents.addProperty("ADBE Vector Shape - Ellipse");
    ellipse.property("ADBE Vector Ellipse Size").setValue([maxSize, maxSize]);
    var stroke = contents.addProperty("ADBE Vector Graphic - Stroke");
    stroke.property("ADBE Vector Stroke Color").setValue(color);
    stroke.property("ADBE Vector Stroke Width").setValue(5);
    stroke.property("ADBE Vector Stroke Opacity").setValue(opacity);
    setPosition(layer, [x, y]);
    setRange(layer, start, end);
    keyframes(transform(layer).property("ADBE Scale"), [start, end], [[6, 6], [100, 100]], 82, 24);
    keyframes(transform(layer).property("ADBE Opacity"), [start, start + 0.12, end], [0, 100, 0], 72, 32);
    layer.motionBlur = true;
    return layer;
  }

  function addIntro(comp, assetFolder) {
    addRipple(comp, "INTRO / MEMBRANE 01", 540, 675, 0.16, 1.06, BLUE, 260, 28);
    addRipple(comp, "INTRO / MEMBRANE 02", 540, 675, 0.28, 1.38, INK, 390, 12);
    addRipple(comp, "INTRO / MEMBRANE 03", 540, 675, 0.42, 1.7, BLUE, 520, 10);

    var core = addDiamond(comp, "INTRO / CORE DIAMOND", 62, 62, BLUE, 540, 675, 100);
    setRange(core, 0.08, 2.86);
    keyframes(transform(core).property("ADBE Opacity"), [0.08, 0.18, 2.42, 2.82], [0, 100, 100, 0], 80, 24);
    keyframes(transform(core).property("ADBE Scale"), [0.08, 0.42, 0.58, 0.76, 1.46, 2.18, 2.5], [
      [0, 0], [126, 126], [92, 92], [100, 100], [100, 100], [132, 132], [36, 36]
    ], 90, 22);
    keyframes(transform(core).property("ADBE Rotate Z"), [0.08, 1.46, 2.48], [0, 90, 135], 82, 28);

    var upperItem = importAsset(ASSETS + "/logo/tradinglab-plane-upper-2048.png", "V2 / LOGO UPPER", assetFolder);
    var lowerItem = importAsset(ASSETS + "/logo/tradinglab-plane-lower-2048.png", "V2 / LOGO LOWER", assetFolder);
    var upper = addFootage(comp, upperItem, "INTRO / UPPER PLANE", 540, 675, 30, 0.48, 3.48);
    var lower = addFootage(comp, lowerItem, "INTRO / LOWER PLANE", 540, 675, 30, 0.58, 3.48);
    keyframes(transform(upper).property("ADBE Opacity"), [0.48, 0.68, 3.14, 3.44], [0, 100, 100, 0], 78, 28);
    keyframes(transform(lower).property("ADBE Opacity"), [0.58, 0.78, 3.14, 3.44], [0, 100, 100, 0], 78, 28);
    keyframes(transform(upper).property("ADBE Position"), [0.48, 1.28, 1.5, 2.34, 3.26], [
      [390, 535], [548, 666], [540, 675], [540, 520], [260, 310]
    ], 90, 22);
    keyframes(transform(lower).property("ADBE Position"), [0.58, 1.34, 1.56, 2.4, 3.26], [
      [690, 825], [532, 684], [540, 675], [540, 830], [820, 1040]
    ], 90, 22);
    keyframes(transform(upper).property("ADBE Scale"), [0.48, 1.28, 1.5, 2.34, 3.24], [[18, 18], [32, 32], [30, 30], [124, 38], [150, 34]], 90, 22);
    keyframes(transform(lower).property("ADBE Scale"), [0.58, 1.34, 1.56, 2.4, 3.24], [[18, 18], [32, 32], [30, 30], [124, 38], [150, 34]], 90, 22);
    keyframes(transform(upper).property("ADBE Rotate Z"), [0.48, 1.28, 1.5, 2.34, 3.24], [-16, 1.6, 0, -8, -18], 88, 24);
    keyframes(transform(lower).property("ADBE Rotate Z"), [0.58, 1.34, 1.56, 2.4, 3.24], [16, -1.6, 0, 8, 18], 88, 24);

    var before = addText(comp, "HOOK / BEFORE", "ANTES DEL CAPITAL,", 34, INK, 540, 490, 115, "Poppins-Medium");
    animateMaterialText(before, 1.62, 3.02, 3.34, 34, 86);
    var goes = addText(comp, "HOOK / GOES", "VA EL", 68, INK, 540, 640, 34, "Poppins-SemiBold");
    animateMaterialText(goes, 1.82, 3.04, 3.36, 46, 82);
    var criterion = addText(comp, "HOOK / CRITERION", "CRITERIO.", 126, BLUE, 540, 760, -20, "Poppins-Bold");
    animateMaterialText(criterion, 1.94, 3.04, 3.38, 64, 78);
  }

  function addMagneticFragments(comp) {
    var startPositions = [
      [210, 490], [340, 380], [520, 420], [700, 360], [865, 500], [190, 720],
      [330, 880], [520, 930], [720, 875], [890, 720], [430, 520], [650, 540]
    ];
    var targetPositions = [
      [285, 565], [350, 545], [420, 565], [490, 545], [560, 565], [630, 545],
      [700, 565], [770, 545], [815, 600], [245, 610], [390, 610], [680, 610]
    ];
    var widths = [30, 54, 26, 64, 34, 46, 28, 58, 36, 44, 24, 52];
    var index;
    for (index = 0; index < startPositions.length; index += 1) {
      var color = index % 3 === 0 ? INK : PAPER;
      var fragment = index % 2 === 0
        ? addDiamond(comp, "LEARN / FRAGMENT " + (index + 1), widths[index], widths[index], color, startPositions[index][0], startPositions[index][1], 100)
        : addRoundedRect(comp, "LEARN / FRAGMENT " + (index + 1), widths[index] * 1.8, widths[index] * 0.62, widths[index] * 0.28, color, startPositions[index][0], startPositions[index][1], 100);
      var localStart = 3.48 + index * 0.035;
      setRange(fragment, localStart, 6.02);
      keyframes(transform(fragment).property("ADBE Opacity"), [localStart, localStart + 0.12, 5.5, 5.92], [0, 100, 100, 0], 78, 28);
      keyframes(transform(fragment).property("ADBE Position"), [localStart, 4.18 + index * 0.022, 4.72 + index * 0.012, 5.48, 5.92], [
        startPositions[index],
        [targetPositions[index][0] + (index % 2 === 0 ? 20 : -20), targetPositions[index][1] + 26],
        targetPositions[index],
        targetPositions[index],
        [540, 675]
      ], 90, 20);
      keyframes(transform(fragment).property("ADBE Rotate Z"), [localStart, 4.72 + index * 0.012, 5.92], [index % 2 === 0 ? -42 : 38, index % 2 === 0 ? 45 : 0, 0], 86, 28);
      keyframes(transform(fragment).property("ADBE Scale"), [localStart, localStart + 0.18, 4.72, 5.5, 5.92], [[0, 0], [118, 118], [100, 100], [100, 100], [35, 35]], 88, 22);
    }

    var learn = addText(comp, "LEARN / HERO", "APRENDE.", 132, PAPER, 540, 680, -22, "Poppins-Bold");
    animateMaterialText(learn, 4.22, 5.46, 5.94, 62, 74);
    var terms = addText(comp, "LEARN / TERMS", "ESTRUCTURA  ·  RIESGO  ·  CONTEXTO", 22, PAPER, 540, 795, 42, "Poppins-Medium");
    animateMaterialText(terms, 4.56, 5.5, 5.94, 26, 86);
  }

  function addAnimatedTrace(comp, name, points, color, width, opacity, drawStart, drawEnd, retractStart, retractEnd) {
    var layer = comp.layers.addShape();
    layer.name = name;
    var contents = addShapeGroup(layer, "TRACE");
    var path = contents.addProperty("ADBE Vector Shape - Group");
    path.property("ADBE Vector Shape").setValue(smoothShape(points, false, 0.17));
    var stroke = contents.addProperty("ADBE Vector Graphic - Stroke");
    stroke.property("ADBE Vector Stroke Color").setValue(color);
    stroke.property("ADBE Vector Stroke Width").setValue(width);
    stroke.property("ADBE Vector Stroke Line Cap").setValue(2);
    stroke.property("ADBE Vector Stroke Line Join").setValue(2);
    stroke.property("ADBE Vector Stroke Opacity").setValue(opacity);
    var trim = contents.addProperty("ADBE Vector Filter - Trim");
    var trimEnd = trim.property("ADBE Vector Trim End");
    var trimStart = trim.property("ADBE Vector Trim Start");
    setPosition(layer, [0, 0]);
    setRange(layer, drawStart, retractEnd + 0.08);
    keyframes(trimEnd, [drawStart, drawEnd, retractEnd], [0, 100, 100], 86, 24);
    keyframes(trimStart, [drawStart, retractStart, retractEnd], [0, 0, 100], 86, 24);
    layer.motionBlur = true;
    return layer;
  }

  function addPractice(comp) {
    var title = addText(comp, "PRACTICE / HERO", "PRACTICA.", 112, PAPER, 540, 330, -18, "Poppins-Bold");
    animateMaterialText(title, 5.88, 8.86, 9.26, 56, 78);
    var sub = addText(comp, "PRACTICE / SUB", "SIN ARRIESGAR CAPITAL.", 24, SOFT_BLUE, 540, 1035, 76, "Poppins-Medium");
    animateMaterialText(sub, 6.08, 8.9, 9.28, 28, 88);

    addAnimatedTrace(comp, "PRACTICE / ATTEMPT 01", [[220, 780], [360, 660], [490, 820], [640, 610], [830, 740]], PAPER, 4, 32, 6.18, 7.16, 7.24, 8.34);
    addAnimatedTrace(comp, "PRACTICE / ATTEMPT 02", [[220, 800], [355, 715], [505, 755], [650, 650], [840, 705]], PALE_BLUE, 5, 48, 6.72, 7.78, 7.88, 8.92);
    addAnimatedTrace(comp, "PRACTICE / LEARNED PATH", [[220, 820], [365, 750], [515, 710], [675, 660], [850, 620]], PAPER, 8, 100, 7.28, 8.52, 9.0, 9.52);

    addRipple(comp, "PRACTICE / IMPACT 01", 490, 820, 6.92, 7.58, PAPER, 170, 34);
    addRipple(comp, "PRACTICE / IMPACT 02", 505, 755, 7.48, 8.12, PALE_BLUE, 150, 34);
    addRipple(comp, "PRACTICE / RESOLUTION", 850, 620, 8.28, 9.18, PAPER, 210, 42);

    var signal = addEllipse(comp, "PRACTICE / LEARNING SIGNAL", 34, 34, PAPER, 220, 820, 100);
    setRange(signal, 6.08, 9.5);
    keyframes(transform(signal).property("ADBE Opacity"), [6.08, 6.22, 9.12, 9.44], [0, 100, 100, 0], 78, 24);
    keyframes(transform(signal).property("ADBE Position"), [6.12, 6.7, 7.12, 7.5, 7.88, 8.32, 8.72, 9.16], [
      [220, 820], [360, 660], [490, 820], [355, 715], [505, 755], [515, 710], [675, 660], [850, 620]
    ], 86, 26);
    keyframes(transform(signal).property("ADBE Scale"), [6.12, 6.34, 7.06, 7.22, 7.66, 7.82, 8.66, 8.82, 9.16], [
      [0, 0], [100, 100], [100, 100], [138, 74], [100, 100], [132, 78], [100, 100], [116, 88], [100, 100]
    ], 88, 22);
    signal.motionBlur = true;
  }

  function addValidation(comp) {
    var title = addText(comp, "VALIDATE / HERO", "VALIDA.", 112, PAPER, 540, 675, -18, "Poppins-Bold");
    animateMaterialText(title, 9.58, 11.36, 11.82, 58, 76);
    var repeat = addText(comp, "VALIDATE / REPEAT", "REPITE", 18, INK, 275, 520, 80, "Poppins-Medium");
    var measure = addText(comp, "VALIDATE / MEASURE", "MIDE", 18, BLUE, 540, 1015, 80, "Poppins-Medium");
    var adjust = addText(comp, "VALIDATE / ADJUST", "AJUSTA", 18, INK, 805, 520, 80, "Poppins-Medium");
    animateMaterialText(repeat, 9.72, 11.35, 11.75, 22, 88);
    animateMaterialText(measure, 9.84, 11.38, 11.78, 22, 88);
    animateMaterialText(adjust, 9.96, 11.4, 11.8, 22, 88);

    addAnimatedTrace(comp, "VALIDATE / INPUT LEFT", [[110, 675], [250, 620], [390, 655], [540, 675]], BLUE, 5, 100, 9.46, 10.44, 10.92, 11.54);
    addAnimatedTrace(comp, "VALIDATE / INPUT RIGHT", [[970, 675], [830, 730], [690, 695], [540, 675]], INK, 5, 46, 9.62, 10.56, 10.74, 11.34);
    addAnimatedTrace(comp, "VALIDATE / INPUT LOWER", [[540, 1080], [490, 930], [520, 810], [540, 675]], BLUE, 5, 40, 9.78, 10.7, 10.86, 11.42);

    addRipple(comp, "VALIDATE / LENS 01", 540, 675, 9.42, 10.66, BLUE, 720, 24);
    addRipple(comp, "VALIDATE / LENS 02", 540, 675, 9.68, 11.05, INK, 860, 16);
    addRipple(comp, "VALIDATE / LENS 03", 540, 675, 10.04, 11.42, BLUE, 980, 12);

    var core = addDiamond(comp, "VALIDATE / RESOLVED CORE", 58, 58, BLUE, 540, 675, 100);
    setRange(core, 10.62, 12.22);
    keyframes(transform(core).property("ADBE Opacity"), [10.62, 10.76, 11.8, 12.16], [0, 100, 100, 0], 80, 24);
    keyframes(transform(core).property("ADBE Scale"), [10.62, 10.86, 11.0, 11.18, 11.7, 12.14], [[0, 0], [132, 132], [94, 94], [100, 100], [100, 100], [34, 34]], 90, 22);
    keyframes(transform(core).property("ADBE Rotate Z"), [10.62, 11.18, 12.14], [-45, 0, 90], 86, 28);
  }

  function addPortalContour(comp, name, start, width, height, radius, color, rotation) {
    var layer = comp.layers.addShape();
    layer.name = name;
    var contents = addShapeGroup(layer, "PORTAL CONTOUR");
    var path = contents.addProperty("ADBE Vector Shape - Group");
    path.property("ADBE Vector Shape").setValue(roundedShape(width, height, radius));
    var stroke = contents.addProperty("ADBE Vector Graphic - Stroke");
    stroke.property("ADBE Vector Stroke Color").setValue(color);
    stroke.property("ADBE Vector Stroke Width").setValue(7);
    stroke.property("ADBE Vector Stroke Opacity").setValue(100);
    setPosition(layer, [540, 675]);
    setRotation(layer, rotation);
    setRange(layer, start, start + 1.7);
    keyframes(transform(layer).property("ADBE Scale"), [start, start + 0.08, start + 1.18, start + 1.56], [[8, 8], [18, 18], [290, 290], [350, 350]], 90, 20);
    keyframes(transform(layer).property("ADBE Opacity"), [start, start + 0.1, start + 0.86, start + 1.56], [0, 72, 42, 0], 76, 28);
    keyframes(transform(layer).property("ADBE Rotate Z"), [start, start + 1.56], [rotation, rotation + (rotation >= 0 ? 18 : -18)], 76, 34);
    layer.motionBlur = true;
    return layer;
  }

  function addPortal(comp) {
    var index;
    for (index = 0; index < 7; index += 1) {
      addPortalContour(
        comp,
        "PORTAL / CONTOUR " + (index + 1),
        11.58 + index * 0.16,
        300 + index * 28,
        280 + index * 24,
        92 + index * 6,
        index % 2 === 0 ? BLUE : INK,
        index % 2 === 0 ? -12 : 12
      );
    }

    var after = addText(comp, "PORTAL / AFTER", "DESPUÉS,", 46, INK, 540, 465, 110, "Poppins-Medium");
    animateMaterialText(after, 12.02, 14.48, 14.86, 42, 64);
    var operate = addText(comp, "PORTAL / OPERATE", "OPERA EN", 86, INK, 540, 625, -8, "Poppins-SemiBold");
    animateMaterialText(operate, 12.36, 14.5, 14.88, 72, 48);
    var real = addText(comp, "PORTAL / REAL", "REAL.", 144, BLUE, 540, 765, -26, "Poppins-Bold");
    animateMaterialText(real, 12.62, 14.52, 14.9, 86, 40);
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
    setRange(layer, start, end);
    layer.motionBlur = true;
    try { layer.collapseTransformation = true; } catch (ignored) {}
    return layer;
  }

  function addEndCard(comp, assetFolder) {
    var lockupItem = importAsset(ASSETS + "/logo/tradinglab-lockup-horizontal-2500.png", "V2 / LOCKUP POSITIVE", assetFolder);
    var lockup = addFootage(comp, lockupItem, "END / TRADINGLAB 13A LOCKUP", 540, 590, 27, 14.62, DURATION);
    keyframes(transform(lockup).property("ADBE Opacity"), [14.62, 14.84, 18], [0, 100, 100], 80, 24);
    keyframes(transform(lockup).property("ADBE Position"), [14.62, 15.22, 15.42, 18], [[540, 760], [540, 575], [540, 590], [540, 590]], 90, 22);
    keyframes(transform(lockup).property("ADBE Scale"), [14.62, 15.18, 15.34, 15.5, 18], [[9, 9], [30, 30], [26, 26], [27, 27], [27, 27]], 90, 22);

    var tagline = addText(comp, "END / TAGLINE", "APRENDE EN DEMO. DECIDE CON CRITERIO.", 28, INK, 540, 760, 22, "Poppins-SemiBold");
    animateMaterialText(tagline, 15.18, 17.96, 18, 30, 86);

    var cta = addRoundedRect(comp, "END / CTA FROM LOWER PLANE", 602, 88, 44, BLUE, 540, 910, 100);
    setRange(cta, 15.44, DURATION);
    keyframes(transform(cta).property("ADBE Opacity"), [15.44, 15.6, 18], [0, 100, 100], 80, 24);
    keyframes(transform(cta).property("ADBE Scale"), [15.44, 15.74, 15.9, 16.08, 18], [[0, 86], [108, 104], [97, 98], [100, 100], [100, 100]], 90, 20);
    var ctaText = addText(comp, "END / CTA LABEL", "ABRIR SIMULADOR DEMO  →", 24, PAPER, 540, 910, 58, "Poppins-SemiBold");
    animateMaterialText(ctaText, 15.66, 17.96, 18, 18, 88);

    addRipple(comp, "END / SIGNAL RETURN 01", 540, 910, 16.2, 17.2, BLUE, 780, 20);
    addRipple(comp, "END / SIGNAL RETURN 02", 540, 590, 16.48, 17.58, BLUE, 640, 18);
  }

  function addLegal(comp) {
    var pill = addRoundedRect(comp, "LEGAL / CONSTANT SURFACE", 1008, 66, 26, PAPER, 540, 1170, 92);
    setRange(pill, 0, DURATION);
    try {
      var contents = pill.property("ADBE Root Vectors Group").property(1).property("ADBE Vectors Group");
      var stroke = contents.addProperty("ADBE Vector Graphic - Stroke");
      stroke.property("ADBE Vector Stroke Color").setValue(BLUE);
      stroke.property("ADBE Vector Stroke Width").setValue(1.5);
      stroke.property("ADBE Vector Stroke Opacity").setValue(22);
    } catch (ignoredStroke) {}
    var text = addText(
      comp,
      "LEGAL / DISCLAIMER",
      "SIMULACIÓN EDUCATIVA  ·  SALDO DEMO SIN VALOR MONETARIO\rNO ES ASESORAMIENTO FINANCIERO",
      16,
      INK,
      540,
      1170,
      10,
      "Poppins-Medium"
    );
    setRange(text, 0, DURATION);
    setOpacity(text, 74);
  }

  function addNoiseOverlay(comp) {
    var layer = comp.layers.addSolid([0.5, 0.5, 0.5], "GRADE / MATERIAL MICROTEXTURE", W, H, 1, DURATION);
    setRange(layer, 0, DURATION);
    setOpacity(layer, 8);
    try {
      layer.blendingMode = BlendingMode.SOFT_LIGHT;
      var noise = layer.property("ADBE Effect Parade").addProperty("ADBE Noise");
      noise.property(1).setValue(2.2);
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

  function prepareProject() {
    if (!app.project) app.newProject();
    if (app.project.numItems === 0) return;
    var activePath = app.project.file ? app.project.file.fsName.toLowerCase() : "";
    var expectedPath = new File(PROJECT_PATH).fsName.toLowerCase();
    var priorPath = new File(V1_PROJECT_PATH).fsName.toLowerCase();
    if (activePath === "") {
      var itemIndex;
      for (itemIndex = 1; itemIndex <= app.project.numItems; itemIndex += 1) {
        if (app.project.item(itemIndex).name === "TRADINGLAB_13A_GOOGLE_MOTION_V2") {
          app.project.close(CloseOptions.DO_NOT_SAVE_CHANGES);
          app.newProject();
          return;
        }
      }
    }
    if (activePath === expectedPath) {
      app.project.close(CloseOptions.DO_NOT_SAVE_CHANGES);
      app.newProject();
      return;
    }
    if (activePath === priorPath) {
      app.project.save();
      app.project.close(CloseOptions.SAVE_CHANGES);
      app.newProject();
      return;
    }
    throw new Error("An unrelated After Effects project is open. Build stopped to preserve it: " + activePath);
  }

  function build() {
    prepareProject();
    app.beginUndoGroup("Build TradingLab 13A Google Motion V2");
    app.project.bitsPerChannel = 16;

    var rootFolder = app.project.items.addFolder("TRADINGLAB_13A_GOOGLE_MOTION_V2");
    var assetFolder = app.project.items.addFolder("01_ASSETS");
    assetFolder.parentFolder = rootFolder;
    var masterFolder = app.project.items.addFolder("02_MASTERS");
    masterFolder.parentFolder = rootFolder;

    var musicItem = importAsset(ASSETS + "/audio/tradinglab-music-bed-100bpm.wav", "AUDIO / MUSIC BED 100 BPM", assetFolder);
    var sfxItem = importAsset(ASSETS + "/audio/tradinglab-sound-design.wav", "AUDIO / SOUND DESIGN", assetFolder);

    var master = app.project.items.addComp("TL_X_13A_GOOGLE_MOTION_V2_4x5_18s", W, H, 1, DURATION, FPS);
    master.parentFolder = masterFolder;
    master.motionBlur = true;
    master.shutterAngle = 200;
    master.shutterPhase = -100;
    master.bgColor = PAPER;

    addBackground(master);
    addInkSweep(master);
    addPaperSweep(master);
    addAmbientField(master);
    addMorphSurface(master);
    addIntro(master, assetFolder);
    addMagneticFragments(master);
    addPractice(master);
    addValidation(master);
    addPortal(master);
    addEndCard(master, assetFolder);

    var musicLayer = master.layers.add(musicItem);
    musicLayer.name = "AUDIO / MUSIC BED";
    setRange(musicLayer, 0, DURATION);
    var sfxLayer = master.layers.add(sfxItem);
    sfxLayer.name = "AUDIO / SOUND DESIGN";
    setRange(sfxLayer, 0, DURATION);
    try {
      transform(musicLayer).property("ADBE Audio Levels").setValue([-7, -7]);
      transform(sfxLayer).property("ADBE Audio Levels").setValue([-3, -3]);
    } catch (ignoredAudio) {}

    addNoiseOverlay(master);
    addLegal(master);

    addMarker(master, 0, "SEED", "13A core presses into the surface");
    addMarker(master, 1.6, "HOOK", "Antes del capital, va el criterio");
    addMarker(master, 3.2, "LEARN", "Matter orders itself");
    addMarker(master, 6.0, "PRACTICE", "Elastic sandbox without capital");
    addMarker(master, 9.2, "VALIDATE", "Signals converge into criterion");
    addMarker(master, 11.7, "PORTAL", "Decision acquires precision");
    addMarker(master, 14.8, "BRAND", "13A resolves and reveals TradingLab");
    addMarker(master, 16.0, "CTA", "Open demo simulator");

    var square = app.project.items.addComp("TL_X_13A_GOOGLE_MOTION_V2_SQUARE_18s", 1080, 1080, 1, DURATION, FPS);
    square.parentFolder = masterFolder;
    square.motionBlur = true;
    square.shutterAngle = 200;
    square.shutterPhase = -100;
    square.bgColor = PAPER;
    var squareLayer = square.layers.add(master);
    squareLayer.name = "V2 MASTER / CENTER SAFE CROP";
    setPosition(squareLayer, [540, 540]);
    setRange(squareLayer, 0, DURATION);

    var controller = master.layers.addNull(DURATION);
    controller.name = "00_CTRL / GOOGLE MOTION TOKENS";
    controller.label = 9;
    try {
      var spring = controller.property("ADBE Effect Parade").addProperty("ADBE Slider Control");
      spring.name = "Spring amplitude";
      spring.property(1).setValue(8);
      var morph = controller.property("ADBE Effect Parade").addProperty("ADBE Slider Control");
      morph.name = "Morph duration frames";
      morph.property(1).setValue(24);
      var grain = controller.property("ADBE Effect Parade").addProperty("ADBE Slider Control");
      grain.name = "Microtexture";
      grain.property(1).setValue(2.2);
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
    log("Layers master: " + master.numLayers);
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
