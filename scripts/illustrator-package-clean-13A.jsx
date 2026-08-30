(function () {
  var base = "C:/Users/brame/Desktop/Work/TradingLab/identidad visual/logo-master-13A-final-2026-08-29";
  var outputFolder = new Folder(base + "/final-editables-ai");
  if (!outputFolder.exists && !outputFolder.create()) {
    throw new Error("No se pudo crear la carpeta de editables: " + outputFolder.fsName);
  }

  var jobs = [
    {
      source: base + "/manual-clean/tradinglab-symbol-master.svg",
      output: outputFolder.fsName + "/tradinglab-symbol-master.ai"
    },
    {
      source: base + "/manual-clean/tradinglab-symbol-duotone.svg",
      output: outputFolder.fsName + "/tradinglab-symbol-duotone.ai"
    },
    {
      source: base + "/manual-clean/tradinglab-symbol-micro.svg",
      output: outputFolder.fsName + "/tradinglab-symbol-micro.ai"
    },
    {
      source: base + "/manual-clean/tradinglab-symbol-duotone-micro.svg",
      output: outputFolder.fsName + "/tradinglab-symbol-duotone-micro.ai"
    },
    {
      source: base + "/brand-system/svg/tradinglab-lockup-horizontal.svg",
      output: outputFolder.fsName + "/tradinglab-lockup-horizontal.ai"
    },
    {
      source: base + "/brand-system/svg/tradinglab-lockup-stacked.svg",
      output: outputFolder.fsName + "/tradinglab-lockup-stacked.ai"
    },
    {
      source: base + "/brand-system/svg/tradinglab-lockup-horizontal-inverse.svg",
      output: outputFolder.fsName + "/tradinglab-lockup-horizontal-inverse.ai"
    }
  ];

  var previousInteractionLevel = app.userInteractionLevel;
  var logLines = [];
  var saveOptions = new IllustratorSaveOptions();
  saveOptions.compatibility = Compatibility.ILLUSTRATOR17;
  saveOptions.pdfCompatible = true;
  saveOptions.compressed = true;
  saveOptions.embedICCProfile = true;

  app.userInteractionLevel = UserInteractionLevel.DONTDISPLAYALERTS;
  try {
    for (var index = 0; index < jobs.length; index += 1) {
      var job = jobs[index];
      var sourceFile = new File(job.source);
      if (!sourceFile.exists) {
        throw new Error("No existe el SVG fuente: " + sourceFile.fsName);
      }

      var documentRef = app.open(sourceFile);
      try {
        var outputFile = new File(job.output);
        documentRef.saveAs(outputFile, saveOptions);
        logLines.push(outputFile.fsName + " | paths=" + documentRef.pathItems.length);
      } finally {
        documentRef.close(SaveOptions.DONOTSAVECHANGES);
      }
    }
  } finally {
    app.userInteractionLevel = previousInteractionLevel;
  }

  var logFile = new File(outputFolder.fsName + "/illustrator-export.log");
  logFile.encoding = "UTF-8";
  logFile.open("w");
  logFile.write(logLines.join("\n") + "\n");
  logFile.close();
}());
