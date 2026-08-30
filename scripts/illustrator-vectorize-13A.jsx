#target illustrator

(function () {
    var sourcePath = "C:/Users/brame/Desktop/Work/TradingLab/identidad visual/logo-master-13A-final-2026-08-29/source/trace-source-duotone-white.png";
    var outputPath = "C:/Users/brame/Desktop/Work/TradingLab/identidad visual/logo-master-13A-final-2026-08-29";
    var logFile = new File(outputPath + "/illustrator-trace.log");
    var doc = null;

    function log(message) {
        logFile.open("a");
        logFile.writeln((new Date()).toUTCString() + "  " + message);
        logFile.close();
    }

    function rgb(r, g, b) {
        var color = new RGBColor();
        color.red = r;
        color.green = g;
        color.blue = b;
        return color;
    }

    function firstFill(item) {
        if (item.typename === "PathItem" && item.filled) return item.fillColor;
        if (item.typename === "CompoundPathItem") {
            for (var i = 0; i < item.pathItems.length; i++) {
                if (item.pathItems[i].filled) return item.pathItems[i].fillColor;
            }
        }
        if (item.typename === "GroupItem") {
            for (var j = 0; j < item.pageItems.length; j++) {
                var nested = firstFill(item.pageItems[j]);
                if (nested) return nested;
            }
        }
        return null;
    }

    function isBlue(color) {
        return color && color.typename === "RGBColor" && color.blue > color.red + 35 && color.blue > color.green + 20;
    }

    function isWhite(color) {
        return color && color.typename === "RGBColor" && color.red > 235 && color.green > 235 && color.blue > 235;
    }

    function recolor(item, color) {
        if (item.typename === "PathItem") {
            item.filled = true;
            item.fillColor = color;
            item.stroked = false;
        } else if (item.typename === "CompoundPathItem") {
            for (var i = 0; i < item.pathItems.length; i++) recolor(item.pathItems[i], color);
        } else if (item.typename === "GroupItem" || item.typename === "Layer") {
            for (var j = 0; j < item.pageItems.length; j++) recolor(item.pageItems[j], color);
        }
    }

    function countAnchors(item) {
        var count = 0;
        if (item.typename === "PathItem") count += item.pathPoints.length;
        else if (item.typename === "CompoundPathItem") {
            for (var i = 0; i < item.pathItems.length; i++) count += countAnchors(item.pathItems[i]);
        } else if (item.typename === "GroupItem" || item.typename === "Layer") {
            for (var j = 0; j < item.pageItems.length; j++) count += countAnchors(item.pageItems[j]);
        }
        return count;
    }

    function setSquareArtboard(document, items, paddingRatio) {
        var left = 1e9;
        var top = -1e9;
        var right = -1e9;
        var bottom = 1e9;
        for (var i = 0; i < items.length; i++) {
            var b = items[i].visibleBounds;
            left = Math.min(left, b[0]);
            top = Math.max(top, b[1]);
            right = Math.max(right, b[2]);
            bottom = Math.min(bottom, b[3]);
        }
        var width = right - left;
        var height = top - bottom;
        var side = Math.max(width, height) * (1 + paddingRatio * 2);
        var cx = (left + right) / 2;
        var cy = (top + bottom) / 2;
        document.artboards[0].artboardRect = [cx - side / 2, cy + side / 2, cx + side / 2, cy - side / 2];
    }

    function setPaddedArtboard(document, items, paddingRatio) {
        var left = 1e9;
        var top = -1e9;
        var right = -1e9;
        var bottom = 1e9;
        for (var i = 0; i < items.length; i++) {
            var b = items[i].visibleBounds;
            left = Math.min(left, b[0]);
            top = Math.max(top, b[1]);
            right = Math.max(right, b[2]);
            bottom = Math.min(bottom, b[3]);
        }
        var width = right - left;
        var height = top - bottom;
        var pad = Math.max(width, height) * paddingRatio;
        document.artboards[0].artboardRect = [left - pad, top + pad, right + pad, bottom - pad];
    }

    function saveAi(document, filePath) {
        var options = new IllustratorSaveOptions();
        options.pdfCompatible = true;
        options.compressed = true;
        options.embedICCProfile = false;
        document.saveAs(new File(filePath), options);
    }

    function exportSvg(document, filePath) {
        var options = new ExportOptionsSVG();
        options.coordinatePrecision = 3;
        options.embedRasterImages = false;
        options.responsive = false;
        document.exportFile(new File(filePath), ExportType.SVG, options);
    }

    function exportPng(document, filePath, scalePercent) {
        var options = new ExportOptionsPNG24();
        options.antiAliasing = true;
        options.transparency = true;
        options.artBoardClipping = true;
        options.horizontalScale = scalePercent;
        options.verticalScale = scalePercent;
        document.exportFile(new File(filePath), ExportType.PNG24, options);
    }

    try {
        app.userInteractionLevel = UserInteractionLevel.DONTDISPLAYALERTS;
        log("START Illustrator " + app.version);

        var source = new File(sourcePath);
        if (!source.exists) throw new Error("Missing trace source: " + sourcePath);

        doc = app.documents.add(DocumentColorSpace.RGB, 1254, 1254);
        var placed = doc.placedItems.add();
        placed.file = source;
        placed.position = [0, 1254];
        placed.width = 1254;
        placed.height = 1254;

        var plugin = placed.trace();
        var options = plugin.tracing.tracingOptions;
        options.tracingMode = TracingModeType.TRACINGMODECOLOR;
        options.maxColors = 3;
        options.fills = true;
        options.ignoreWhite = true;
        options.pathFitting = 2.6;
        options.cornerAngle = 62;
        options.minArea = 32;
        options.preprocessBlur = 0.45;
        options.resampleResolution = 300;
        app.redraw();

        var expanded = plugin.tracing.expandTracing();
        app.redraw();
        log("Trace expanded; child items=" + expanded.pageItems.length);

        var upperLayer = doc.layers.add();
        upperLayer.name = "Plane - Upper";
        var lowerLayer = doc.layers.add();
        lowerLayer.name = "Plane - Lower";
        var upperGroup = upperLayer.groupItems.add();
        upperGroup.name = "Plane - Upper";
        var lowerGroup = lowerLayer.groupItems.add();
        lowerGroup.name = "Plane - Lower";

        var children = [];
        for (var i = 0; i < expanded.pageItems.length; i++) children.push(expanded.pageItems[i]);
        var kept = 0;
        for (var j = children.length - 1; j >= 0; j--) {
            var item = children[j];
            var fill = firstFill(item);
            if (isWhite(fill)) {
                item.remove();
                continue;
            }
            if (isBlue(fill)) item.move(lowerGroup, ElementPlacement.PLACEATEND);
            else item.move(upperGroup, ElementPlacement.PLACEATEND);
            kept++;
        }
        try { expanded.remove(); } catch (removeError) {}

        var ink = rgb(7, 19, 36);
        var blue = rgb(24, 90, 219);
        var paper = rgb(247, 249, 252);
        var black = rgb(0, 0, 0);
        recolor(upperGroup, ink);
        recolor(lowerGroup, blue);
        setSquareArtboard(doc, [upperGroup, lowerGroup], 0.10);

        log("Classified items=" + kept + "; upper anchors=" + countAnchors(upperGroup) + "; lower anchors=" + countAnchors(lowerGroup));

        saveAi(doc, outputPath + "/tradinglab-symbol-duotone.ai");
        exportSvg(doc, outputPath + "/tradinglab-symbol-duotone.svg");

        recolor(lowerGroup, ink);
        saveAi(doc, outputPath + "/tradinglab-symbol-master.ai");
        exportSvg(doc, outputPath + "/tradinglab-symbol-master.svg");
        exportPng(doc, outputPath + "/tradinglab-symbol-master-2048.png", 163.32);

        recolor(upperGroup, black);
        recolor(lowerGroup, black);
        exportSvg(doc, outputPath + "/tradinglab-symbol-black.svg");

        recolor(upperGroup, paper);
        recolor(lowerGroup, paper);
        exportSvg(doc, outputPath + "/tradinglab-symbol-inverse.svg");

        recolor(upperGroup, ink);
        recolor(lowerGroup, ink);

        var symbolGroup = doc.groupItems.add();
        upperGroup.move(symbolGroup, ElementPlacement.PLACEATEND);
        lowerGroup.move(symbolGroup, ElementPlacement.PLACEATEND);
        symbolGroup.name = "TradingLab Symbol";

        var textFrame = doc.textFrames.pointText([symbolGroup.left + symbolGroup.width + symbolGroup.width * 0.16, symbolGroup.top - symbolGroup.height * 0.40]);
        textFrame.contents = "TradingLab";
        textFrame.textRange.characterAttributes.textFont = app.textFonts.getByName("Poppins-SemiBold");
        textFrame.textRange.characterAttributes.size = symbolGroup.height * 0.285;
        textFrame.textRange.characterAttributes.fillColor = ink;
        textFrame.textRange.characterAttributes.tracking = -22;
        var wordmark = textFrame.createOutline();
        wordmark.name = "TradingLab Wordmark";
        wordmark.left = symbolGroup.left + symbolGroup.width + symbolGroup.width * 0.16;
        wordmark.top = symbolGroup.top - (symbolGroup.height - wordmark.height) / 2;

        setPaddedArtboard(doc, [symbolGroup, wordmark], 0.075);
        saveAi(doc, outputPath + "/tradinglab-lockup-horizontal.ai");
        exportSvg(doc, outputPath + "/tradinglab-lockup-horizontal.svg");
        exportPng(doc, outputPath + "/tradinglab-lockup-horizontal-2400.png", 150);

        log("SUCCESS master, duotone, inverse, black and horizontal lockup exported");
        doc.close(SaveOptions.DONOTSAVECHANGES);
        doc = null;
    } catch (error) {
        log("ERROR " + error.message + " line=" + error.line);
        try { if (doc) doc.close(SaveOptions.DONOTSAVECHANGES); } catch (closeError) {}
    } finally {
        app.userInteractionLevel = UserInteractionLevel.DISPLAYALERTS;
    }
})();
