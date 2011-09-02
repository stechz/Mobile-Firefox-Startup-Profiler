// LOGPARSER
// By Benjamin Stover
//
// The parser works by sorting the log into a stack of events created from
// registered classifiers. If a different type of event happens inside of
// another event, the order of the classifiers comes into play. Earlier
// defined classifiers will behave as if the later embedded event never
// happened. Later classifiers will interrupt their event for the earlier
// embedded event, and will resume when the embedded event ends.
//
// The parsing process is divided into several steps. Check out
// logparser.test.js to get a feeling for how it all works.

(function() {

Array.prototype.mapfilter = function(fn) {
  return this.map(fn).filter(function(item) { return item !== undefined; });
};

var defaultFilter = /^I\/Gecko.*default\s*([\d\.]+)..(<|>).*\|(.*)/;

var registered = [];
var optionJson = {};

// Used to register classifiers that parse the log. See below.
function register(fn, options) {
  if (options) {
    if (optionJson[options.header] === undefined)
      optionJson[options.header] = [];
    optionJson[options.header].push({
      id: options.id,
      label: options.label,
      selected: options.isDefault
    });
  }

  var newOptions = options || {};
  newOptions.index = registered.length;
  newOptions.alwaysRun = newOptions.alwaysRun || !options;
  newOptions.runIffChecked = newOptions.runIffChecked === undefined ?
    true : options.runIffChecked;
  registered.push({
    run: function(c) {
      if (newOptions.alwaysRun || newOptions.runIffChecked === c.isChecked())
        fn(c);
    },
    options: newOptions
  });
}

//////////////////////////////////////////////////////////////////////////////
// CLASSIFERS
//   If you want to classify things from the log, it goes here.
//   Order matters. Earlier things will take priorities if there are interval
//   conflicts.
//////////////////////////////////////////////////////////////////////////////

// Filter that adds before main
register(function(c) {
  var processStart = null;
  var funcStart = null;
  var lines = c.lines();
  var regex = /^.*STARTUP LOG\D+|\s+$/g;
  for (var i = 0; i < lines.length; i++) {
    var l = lines[i];
    if (l.indexOf("STARTUP LOG FunctionTimer") != -1 && !funcStart)
      funcStart = Math.floor(parseInt(l.replace(regex, "")) / 1000);
    if (l.indexOf("STARTUP LOG Process") != -1 && !processStart)
      processStart = parseInt(l.replace(regex, ""));
  }

  var beforeMainOffset = funcStart - processStart;
  if (!isNaN(beforeMainOffset)) {
    c.mapfilter(function(m) {
      m.time += beforeMainOffset;
      return m;
    });
  }
}, {
  header: "Include Intervals",
  label: "From start of process to main",
  id: "before-main",
  isDefault: true,
});

// Filter that removes everything after first paint
register(function(c) {
  var afterFirstPaint = false;
  c.filter(function(match) {
    if (!afterFirstPaint && match.data.indexOf("PresShell::Paint") != -1) {
      afterFirstPaint = true;
      return true;
    }
    return !afterFirstPaint;
  });
}, {
  header: "Include Intervals",
  label: "After first paint onwards",
  id: "after-first-paint",
  isDefault: false,
  runIffChecked: false
});

// Currently no way to catch things before component manager is initialized.
register(function(c) {
  var first = c.matches()[0];
  c.manualTime("Before component manager is initialized", 0, first.time,
               0, first.lineNumber);
});

// Font loading
register(function(c) {
  c.intervals("gfx: Loading fonts", /gfx\/info/, /gfx\/init/, 1);
});

// Javascript
register(function(c) {
  c.openClose("Javascript", /nsXBLProtoImplMethod::CompileMember/);
  c.openClose("Javascript", /nsXBLProtoImplMethod::CompileFunction/);
  c.openClose("Javascript", /mozJSComponentLoader::Import/);
  c.openClose("Javascript", /mozJSComponentLoader::LoadModuleImpl/);
  c.openClose("Javascript", /nsXBLProtoImplField::InstallField/);
});

// Layout
register(function(c) {
  c.openClose("layout: Loading stylesheets", /Loading stylesheet.*sync/);
  c.openClose("layout: InitialReflow", /InitialReflow/);
  c.openClose("layout: Flush pending notifications", /FlushPendingNotifications/);
});

// XUL parsing
register(function(c) {
  c.openClose("XUL parsing", /nsXULPrototypeDocument::Read/);
});

// Miscellaneous
register(function(c) {
  c.openClose("Main thread event", /Main Thread Event/);
  c.intervals("XPTI Loading", /xptiInterfaceInfoManager/, /chrome-registry/, 1);
});

//////////////////////////////////////////////////////////////////////////////
// LOG PARSING STEPS
//////////////////////////////////////////////////////////////////////////////

// Convert array of text lines to JSON match form
function linesToMatch(text) {
  return text.mapfilter(function(s, i) {
    var match = s.match(defaultFilter)
    return match ? {
      time: parseInt(match[1]),
      openClose: match[2],
      data: match[3],
      original: s,
      lineNumber: i
    } : undefined;
  });
}

// Parse JSON into an intermediate JSON form
// If you want to classify, code goes in here!
function generateMap(matches, setOptions, lines) {
  var map = {};
  var registrar = null;

  function logMessage(message, begin, end, beginLine, endLine) {
    if (map[begin] === undefined)
      map[begin] = [];
    if (map[end] === undefined)
      map[end] = [];

    map[begin].push({
      message: message,
      type: "begin",
      registrar: registrar.options,
      lineNumber: beginLine
    });
    map[end].push({
      message: message,
      type: "end",
      registrar: registrar.options,
      lineNumber: endLine
    });
  }

  var classifyEnvironment = {
    lines: function() {
      return lines || [];
    },

    matches: function() {
      return matches;
    },

    isChecked: function() {
      var options = registrar.options;
      return options && setOptions[options.id] === true;
    },

    filter: function(fn) {
      matches = matches.filter(fn);
    },

    mapfilter: function(fn) {
      matches = matches.mapfilter(fn);
    },

    manualTime: function(message, beginTime, endTime, beginLine, endLine) {
      logMessage(message, beginTime, endTime, beginLine, endLine);
    },

    intervals: function(message, begin, end, howMany) {
      function convertToTimes(regex) {
        return matches.mapfilter(function(t) {
          return t.data.match(regex) ? t : undefined;
        });
      }

      howMany = howMany || Number.MAX_VALUE;
      var beginArray = convertToTimes(begin);
      var endArray = convertToTimes(end);
      var beginIndex = 0;
      var endIndex = 0;
      var begin = beginArray[beginIndex];
      var end = endArray[endIndex];

      function nextBegin() {
        beginIndex++;
        begin = beginArray[beginIndex];
        return (beginIndex < beginArray.length);
      }

      function nextEnd() {
        endIndex++;
        end = endArray[endIndex];
        return (endIndex < endArray.length);
      }

      while (true) {
        if (!begin)
          return;

        while (begin.time > end.time) {
          if (!nextBegin())
            return;
        }

        logMessage(message,
                   begin.time, end.time,
                   begin.lineNumber, end.lineNumber);

        if (--howMany == 0)
          return;

        if (!nextBegin())
          return;
        while (begin.time < end.time) {
          if (!nextBegin())
            return;
        }

        if (!nextEnd())
          return;
      }
    },

    openClose: function(message, filter) {
      var array = matches.mapfilter(function(t) {
        return t.data.match(filter) ? t : undefined;
      });

      if (array.length === 0 || array.length % 2 != 0)
        return;

      var stack = 0;
      var topOfStack = null;
      for (var i = 0; i < array.length; i++) {
        if (stack === 0)
          topOfStack = array[i];

        var item = array[i];
        stack = stack + (item.openClose == '>' ? 1 : -1);

        if (stack === 0)
          logMessage(message, topOfStack.time, item.time,
                     topOfStack.lineNumber, item.lineNumber);
      }
    }
  };

  for (var i = 0; i < registered.length; i++) {
    registrar = registered[i];
    registrar.run(classifyEnvironment);
  }

  var finalMatch = matches[matches.length - 1];
  var finalTime = finalMatch.time;
  var finalLineNumber = finalMatch.lineNumber
  classifyEnvironment.manualTime("End", finalTime, finalTime,
                                 finalLineNumber, finalLineNumber);

  return map;
}

// Generate array that will turn into timeline from intermediate form
function generateArray(map) {
  var keys = Object.keys(map);
  keys = keys.map(function(k) { return parseInt(k); }).sort(function(a, b) {
    return a - b;
  });

  var result = [];
  var begin = 0;
  var messageStack = [];
  var lastLineNumber = 0;
  function peek() {
    var length = messageStack.length;
    return length ? messageStack[length - 1] : {
      message: "Unclassified",
      index: Number.MAX_VALUE
    };
  }
  function pop() {
    return messageStack.pop() || peek();
  }
  function addEvent(message, time, lineNumber) {
    if (time - begin > 0) {
      var lastResult = result[result.length - 1];
      if (lastResult && lastResult.message == message) {
        lastResult.duration += time - begin;
        lastResult.endLineNumber = lineNumber;
      } else {
        result.push({
          message: message,
          duration: time - begin,
          beginLineNumber: lastLineNumber,
          endLineNumber: lineNumber
        });
      }
      begin = time;
    }
    lastLineNumber = lineNumber;
  }

  var time;
  for (var i = 0; i < keys.length; i++) {
    time = keys[i];
    var jsons = map[time];
    for (var j = 0; j < jsons.length; j++) {
      var json = jsons[j];

      if (messageStack.length === 0) {
        if (json.type !== "begin")
          throw "Was expecting begin event.";
        addEvent(pop().message, time, json.lineNumber);
      }

      if (json.type == "begin") {
        if (json.registrar.index <= peek().index &&
            json.message != peek().message)
          addEvent(peek().message, time, json.lineNumber);
        messageStack.push(
          { message: json.message, index: json.registrar.index });
      } else if (json.type == "end") {
        var popped = pop();
        if (popped.index <= peek().index && popped.message != peek().message)
          addEvent(popped.message, time, json.lineNumber);
      }
    }
  }

  return result;
}

function parse(text, setOptions) {
  var lines = text.split("\n");
  var matches = linesToMatch(lines);
  var map = generateMap(matches, setOptions, lines);
  var array = generateArray(map);
  return array;
}

window.logparser = {
  linesToMatch: linesToMatch,
  generateMap: generateMap,
  generateArray: generateArray,
  parse: parse
};

//////////////////////////////////////////////////////////////////////////////
// GLUE TO TIMELINE.HTML
//////////////////////////////////////////////////////////////////////////////

window.makeLogOptions = function() {
  return optionJson;
};

window.logLoadFile = function(files, options) {
  if (files.length == 0)
    return false;

  var reader = new FileReader();
  reader.readAsText(files[0]);
  reader.onload = function(e) {
    timelineReady(parse(e.target.result, options), e.target.result);
  };

  return true;
};

})();
