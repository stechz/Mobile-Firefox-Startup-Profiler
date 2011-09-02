// STARTUP.JS
// By Benjamin Stover
// Goes with timeline.html

(function() {

//////////////////////////////////////////////////////////////////////////////
// SELECTION CODE
//////////////////////////////////////////////////////////////////////////////

var logMode = false;
var selectionMode = false;
var selectedSection = null;
var originalHeight = null;

function enterLogMode() {
  if (!selectedSection)
    return;
  if (logMode)
    return;
  logMode = true;

  var liSelected = description.querySelector("li.select");
  if (liSelected)
    liSelected.scrollIntoView();
  var ol = description.querySelector("ol")
  ol.style.height = "100px";

  var log = document.getElementById("log");
  var container = document.getElementById("timeline-container");
  var figure = container.querySelector("figure");
  var rect = figure.getBoundingClientRect();
  figure.style.height = rect.height + "px";
  originalHeight = rect.height;
  figure.style.height = "0px";
  log.style.height = (window.innerHeight - rect.height - 20) + "px";
  log.style.opacity = "1";

  select(selectedSection);
}

function exitLogMode() {
  if (!logMode)
    return;
  logMode = false;

  var container = document.getElementById("timeline-container");
  var figure = container.querySelector("figure");
  var log = document.getElementById("log");
  var ol = description.querySelector("ol")

  log.style.removeProperty("opacity");
  figure.style.height = originalHeight + "px";
  log.style.removeProperty("height");
  if (!logMode)
    return;

  figure.style.removeProperty("height");
  if (selectedSection) {
    ol.style.display = "block";
    select(selectedSection);
  }

  if (selectedSection) {
    select(selectedSection);
    ol.style.height="100px";
  }
}

function select(section) {
  var toggleLogNode = document.getElementById("toggleLog");
  toggleLogNode.removeAttribute("disabled");

  var sameSection =
    selectedSection &&
    section.json().label == selectedSection.json().label;

  selectedSection = section;

  var color = section.color();
  var div = document.createElement("div");
  div.style.color = color;
  color = getComputedStyle(div, null).color.replace(/^rgb\(|\)$/g, "");

  var color5 = "rgba(" + color + ", .3)";
  var color3 = "rgba(" + color + ", .1)";
  var color0 = "rgba(" + color + ", 0)";

  var descriptionBG = document.querySelector(".description-background:not(.select)");
  var oldDescription = document.querySelector(".description-background.select");
  descriptionBG.style.backgroundImage =
    "-moz-radial-gradient(center top, ellipse farthest-side, rgba(130, 130, 130, 0.5), rgba(130, 130, 130, 0) 75%)," +
    "-moz-radial-gradient(center top, ellipse farthest-side, " + color5 + ", " + color0 + ")," +
    "-moz-radial-gradient(center top, ellipse farthest-side, " + color3 + ", " + color0 + ")";

  var json = section.json();
  relativeEntries = example.filter(json.label);
  var time = relativeEntries.totalTime();
  if (!sameSection) {
    var html = [
      "<h1>" + json.label + "</h1>",
      "<p>Total time: " + time + "</h1>",
      "<ol>"
    ];
    for (var i = 0; i < relativeEntries.entries.length; i++) {
      var entryJson = relativeEntries.entries[i];
      html.push("<li data-absindex='" + entryJson.index + "'><div class='time' data-index='" + i + "'><div class='primary'>" + entryJson.valueLabel + "</div><div class='secondary'>" + (entryJson.value / time * 100).toFixed(2) + "%</div></a>");
    }
    html.push("</ol>");

    description.innerHTML = html.join("");
    descriptionBG.classList.add("select");
    if (oldDescription)
      oldDescription.classList.remove("select");
  }

  var ol = description.querySelector("ol");
  if (logMode) {
    ol.style.height = "100px";
  } else if (ol.style.height == "100px" || !ol.style.height) {
    ol.style.height = "0px";
    var rect = ol.getBoundingClientRect();
    ol.style.height = (window.innerHeight - rect.top - 50) + "px";
  }

  var oldSelectedLi = description.querySelector("li.select")
  if (oldSelectedLi)
    oldSelectedLi.classList.remove("select");
  var selectedLi = description.querySelector("li[data-absindex='" + json.index + "']");
  selectedLi.classList.add("select");

  if (logMode) {
    var log = document.getElementById("log");
    var text = log.textContent;
    var index = 0;
    var count = 0;
    var firstLetter = 0;
    var lastLetter = 0;
    var length = text.length;
    var i;
    for (i = 0; i < length; i++) {
      if (count === json.beginLineNumber) {
        firstLetter = i;
        break;
      }
      if (text.charAt(i) == '\n')
        count++;
    }
    for (; i < length; i++) {
      if (count === json.endLineNumber + 1) {
        lastLetter = i - 1;
        break;
      }
      if (text.charAt(i) == '\n')
        count++;
    }

    var selection = window.getSelection();
    selection.removeAllRanges();
    var range = document.createRange();
    range.setStart(log.firstChild, firstLetter);
    range.setEnd(log.firstChild, lastLetter);
    selection.addRange(range);
    var rangeRect = range.getBoundingClientRect();
    var logRect = log.getBoundingClientRect();
    log.scrollTop = rangeRect.top - logRect.top + log.scrollTop;
  } else {
    section.showLabel();
  }
}

//////////////////////////////////////////////////////////////////////////////
// DESCRIPTION EVENTS
//////////////////////////////////////////////////////////////////////////////

var relativeEntries;
var description = document.querySelector(".description");

var hoveredOverA = false;
var timeoutHandle = null;

function stopHoveringSoon() {
  if (timeoutHandle) {
    clearTimeout(timeoutHandle);
    timeoutHandle = null;
  }
  timeoutHandle = setTimeout(function() {
    if (!hoveredOverA && selectedSection)
      selectedSection.showLabel();
  }, 200);
}

if (description) {
  description.addEventListener("click", function(ev) {
    if (!ev.target.classList.contains("time"))
      return;
    var index = parseInt(ev.target.dataset.index);
    var entry = relativeEntries.filter(index);
    var json = entry.json();
    select(entry);
  }, false);

  description.addEventListener("mouseover", function(ev) {
    if (!ev.target.classList.contains("time")) {
      stopHoveringSoon();
      hoveredOverA = false;
      return;
    }
    hoveredOverA = true;
    var index = parseInt(ev.target.dataset.index);
    var entry = relativeEntries.filter(index);
    entry.showLabel();
  }, false);

  description.addEventListener("mouseout", function(ev) {
    if (ev.target.classList.contains("time"))
      return;
    hoveredOverA = false;
    stopHoveringSoon();
  }, false);
}

//////////////////////////////////////////////////////////////////////////////
// TIMELINE EVENTS
//////////////////////////////////////////////////////////////////////////////

function keyPress(ev) {
  if (logMode)
    return;

  var delta = 0;
  switch (ev.keyCode) {
    case 39: // right
      delta = 1;
      break;
    case 37: // left
      delta = -1;
      break;
    default:
      return;
  }

  selectionMode = true;

  var selected = example.labelled();
  if (selected.entries.length === 0) {
    selected = example.filter(0);
    delta = 0;
  }

  var section = example.filter(selectedSection.json().index + delta);
  if (!section.json())
    return;
  select(section);
}

function mouseMove(ev) {
  var section = example.filter(ev.target);
  section.showLabel();
}

function mouseOut(ev) {
  if (selectedSection) {
    selectedSection.showLabel();
    return;
  }

  example.hideLabel();
}

function mouseClick(ev) {
  var section = example.filter(ev.target);
  if (!section.entries.length)
    return;

  selectionMode = true;
  select(section);
}

//////////////////////////////////////////////////////////////////////////////
// LEGEND EVENTS
//////////////////////////////////////////////////////////////////////////////

var legend = document.getElementById("timeline-legend");
if (legend) {
  legend.addEventListener("click", function(ev) {
    var a = ev.target;
    if (a.tagName !== "A")
      return;
    select(example.filter(a.innerHTML));
  }, false);
}

//////////////////////////////////////////////////////////////////////////////
// OPTIONS EVENTS
//////////////////////////////////////////////////////////////////////////////

var options = document.getElementById("timeline-options");
if (options) {
  options.addEventListener("change", function(ev) {
    var node = ev.target;
    if (ev.target.type != "checkbox")
      return;

    description.innerHTML = "";
    var bg = document.querySelector(".description-background.select");
    if (bg)
      bg.classList.remove("select");

    selectionMode = false;
    selectedSection = null;

    loadFile();
  }, false);
}

//////////////////////////////////////////////////////////////////////////////
// SAVE AS
//////////////////////////////////////////////////////////////////////////////

function makeRequest(url, callback) {  
  var httpRequest = new XMLHttpRequest();  
  httpRequest.onreadystatechange = function() {
    if (httpRequest.readyState == 4 && httpRequest.responseText) {
      callback(httpRequest.responseText);
    }
  };
  httpRequest.open('GET', url);  
  httpRequest.overrideMimeType('text/javascript');
  httpRequest.send();
}

var saveAs = document.getElementById("saveAs");
if (saveAs) {
  saveAs.addEventListener("click", function() {
    var upload = document.getElementById("uploadArticle");
    upload.parentNode.removeChild(upload);
    saveAs.parentNode.removeChild(saveAs);

    var emptyThem = document.querySelectorAll("timeline,.description-background,.description");
    for (var i = 0; i < emptyThem.length; i++) {
      emptyThem[i].innerHTML = "";
      emptyThem[i].style.removeProperty("background-image");
    }

    exitLogMode();

    var scripts = document.querySelectorAll("script[src]");
    var numCallbacks = 0;
    for (var i = 0; i < scripts.length; i++) {
      (function(i) {
        var src = scripts[i].getAttribute("src");
        scripts[i].removeAttribute("src");
        makeRequest(src, function(text) {
          scripts[i].textContent = text;
          if (++numCallbacks == scripts.length) {
            var html = "<!DOCTYPE html>\n<html>" + document.documentElement.innerHTML + "\n</html>\n";
            document.body.innerHTML = "<div id='copypaste'></div>";
            var split = html.split("\n");
            for (var j = 0; j < split.length; j++) {
              var div = document.createElement("div");
              div.textContent = split[j];
              document.body.firstChild.appendChild(div);
            }
          }
        });
      })(i);
    }
  }, false);
}

//////////////////////////////////////////////////////////////////////////////
// GLUE WITH LOG PARSER
//////////////////////////////////////////////////////////////////////////////

function hideArticles() {
  var articles = document.querySelectorAll("article");
  for (var i = 0; i < articles.length; i++)
    articles[i].classList.remove("select");
}

function makeLogOptionsHTML() {
  var html = [];
  var options = makeLogOptions();
  var keys = Object.keys(options);
  for (var i = 0; i < keys.length; i++) {
    var header = keys[i];
    var section = options[header];
    html.push("<dt>" + header + "</dt>");
    for (var j = 0; j < section.length; j++) {
      var option = section[j];
      var label = option.label;
      var selected = option.selected;
      var id = option.id;
      html.push("<dd><input id='" + id + "'" + "name='" + name + "' type='checkbox' " +
                (selected ? "checked>" : ">"));
      html.push("<label for='" + id + "'>" + label + "</label></dd>");
    }
  }
  document.querySelector("#timeline-options dl").innerHTML = html.join("\n");
}

function makeOptionsJSON() {
  var json = {};
  var options = document.getElementById("timeline-options");
  var checkboxes = options.querySelectorAll('input[type="checkbox"]');
  for (var i = 0; i < checkboxes.length; i++)
    json[checkboxes[i].id] = !!checkboxes[i].checked;
  return json;
}

function makeLegendHTML() {
  var html = "";
  var labels = example.labels();
  for (var i = 0; i < labels.length; i++) {
    var label = labels[i];
    var color = example.filter(label).color();
    html += "<div><dt style='background-color: " + color + "'></dt>" +
            "<dd><a href='#foo' onclick='return false;'>" + labels[i] + "</a></dd></div>";
  }
  return html;
}

window.toggleLogMode = function() {
  try {
    logMode ? exitLogMode() : enterLogMode();
  } catch(e) {
    // So we don't go to the link.
    console.error(e);
  }
};

window.loadFile = function() {
  var log = document.getElementById("log");
  if (log && log.textContent.trim()) {
    var array = logparser.parse(log.textContent, makeOptionsJSON());
    timelineReady(array, log.textContent);
    return false;
  } else {
    var files = document.getElementById("upload").files;
    return logLoadFile(files, makeOptionsJSON());
  }
};

window.timelineReady = function(array, logFile) {
  // Convert timeline array into HTML that timeline can use
  function toHTML(array) {
    return array.map(function(data) {
      return data.message + ": " + data.duration + "ms";
    }).join(",\n");
  }

  exitLogMode();
  hideArticles();

  var article = document.getElementById("timeline");
  article.classList.add("select");

  var node = document.getElementsByTagName("timeline")[0]
  var html = toHTML(array);
  node.innerHTML = html;
  example = timeline(node);

  for (var i = 0; i < example.entries.length; i++) {
    var entry = example.entries[i];
    entry.beginLineNumber = array[i].beginLineNumber;
    entry.endLineNumber = array[i].endLineNumber;
  }

  document.addEventListener("keypress", keyPress, false);
  node.addEventListener("mousemove", mouseMove, false);
  node.addEventListener("mouseout", mouseOut, false);
  node.addEventListener("click", mouseClick, false);

  document.querySelector("#timeline-legend dl").innerHTML = makeLegendHTML();
  document.getElementById("timeline-total-time").innerHTML =
    example.totalTime();
  document.getElementById("toggleLog").setAttribute("disabled", "true");

  var log = document.getElementById("log");
  log.textContent = logFile;
};

if (!window.test) {
  makeLogOptionsHTML();

  var example = null;

  if (loadFile())
    hideArticles();
}

})();
