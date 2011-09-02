// TIMELINE.JS
// By Benjamin Stover
//
// Makes pretty timelines and allows you to navigate its events.

(function() {

var arrowSvgLeft = [
  '<svg xmlns="http://www.w3.org/2000/svg" width="100px" preserveAspectRatio="none" viewBox="0 0 1 1">',
  '  <path d="M0,.5 L1,0 L1,1 Z" fill="#444"/>',
  '</svg>'
].join("");

var arrowSvgRight = [
  '<svg xmlns="http://www.w3.org/2000/svg" width="100px" preserveAspectRatio="none" viewBox="0 0 1 1">',
  '  <path d="M1,.5 L0,0 L0,1 Z" fill="#444"/>',
  '</svg>'
].join("");

if (document.styleSheets[0]) {
  var sheet = document.styleSheets[0];
  sheet.insertRule(".timeline-arrow {}", sheet.cssRules.length);
  var style = sheet.cssRules[sheet.cssRules.length - 1].style;
  var stuff = "url(data:image/svg+xml," + encodeURIComponent(arrowSvgLeft) + ")";
  var stuff2 = "url(data:image/svg+xml," + encodeURIComponent(arrowSvgRight) + ")";
  style.backgroundImage = stuff + "," + stuff2;
  style.backgroundRepeat = "no-repeat, no-repeat";
  style.backgroundPosition = "top right, top left";
  style.backgroundSize = ".3em .5em, .3em .5em";
}

// Parses timeline entries into a JSON structure
function entriesFromNode(node) {
  var entries = node.innerHTML.split(",");
  return entries.map(function(entry, i) {
    var match = entry.match(/^\s*(.+)\s*:\s+(\S+)/);
    return {
      label: match[1],
      valueLabel: match[2],
      value: parseInt(match[2].replace(/[\D\.]/g, "")),
      index: i
    };
  });
}

function Path() {
  this.str = "";
}

Path.prototype = {
  move: function(x, y) {
    this.str += "M" + x + "," + y + " ";
  },

  line: function(x, y) {
    this.str += "L" + x + "," + y + " ";
  },

  complete: function() {
    this.str += "Z ";
  },

  rect: function(x, y, w, h) {
    this.move(x, y);
    this.line(x + w, y);
    this.line(x + w, y + h);
    this.line(x, y + h);
    this.complete();
  },

  arc: function(x, y, radiusW, radiusH) {
    this.str += "A" + radiusW + "," + radiusH + " 0 0,0" + x + "," + y + " ";
  },

  toString: function() {
    return this.str;
  }
};

// Returns a function that gives a color from the palette.
function colorFactory(numberOfSlices) {
  var hueChunks = Math.min(12, numberOfSlices);
  var lightnessChunks = Math.min(5, Math.floor(numberOfSlices / hueChunks));
  var saturationChunks = Math.min(
    2, Math.floor(Math.floor(numberOfSlices / hueChunks) / lightnessChunks));

  var i = 0;
  var length = hueChunks * lightnessChunks * saturationChunks;
  var colors = {};
  return function(label) {
    if (!colors[label]) {
      var i_h = (i % hueChunks);
      var i_l = Math.floor(i / hueChunks);
      var i_s = Math.floor(Math.floor(i / hueChunks) / saturationChunks);
      var h = i_h / hueChunks * 360;
      var l = (50 + i_l / lightnessChunks * 100) % 100;
      var s = 80 - i_s / saturationChunks * 80;

      i = (i + 1) % length;
      colors[label] = "hsl(" + h + "," + s + "%," + l + "%)";
    }
    return colors[label];
  };
}

function Timeline(entries, node, parent) {
  this.entries = entries;
  this.node = node;
  this.parent = parent;
  this._transitionEnd = this._transitionEnd.bind(this);
}

Timeline.prototype = {
  _constructSVG: function() {
    var time = this.totalTime();
    var tenths = time / 10;
    var shiftDigits = Math.max(2, ("" + Math.floor(tenths)).length) - 2;
    var shift = Math.pow(10, shiftDigits);
    var units = Math.floor(tenths / shift / 5) * shift * 5;
    var numberUnits = Math.floor(time / units);

    var node = this.node;
    var rect = node.getBoundingClientRect();
    rect = { width: rect.width, height: 50 };
    var pixelsPerUnit = rect.width / this.totalTime() * units;

    var paths = "";

    var entries = this.entries;
    var factory = colorFactory(this.labels().length);
    var timeSoFar = 0;
    for (var i = 0; i < entries.length; i++) {
      var backgroundPath = new Path();
      var width = entries[i].value / time * rect.width;
      entries[i].left = timeSoFar;
      entries[i].right = timeSoFar + width;
      backgroundPath.rect(timeSoFar, 0, width, rect.height);
      timeSoFar += width;
      paths += "<g><path clip-path='url(#borderClip)' d='" + backgroundPath + "' fill='" + factory(entries[i].label) + "'/></g>";
    }

    var glow = new Path();
    var ellipseY = rect.height / 3;
    var padding = -10;
    glow.move(padding, ellipseY);
    glow.arc(rect.width - padding, ellipseY, rect.width / 1.5, rect.height / 4);
    glow.line(rect.width - padding, 0);
    glow.line(0, 0);
    paths += "<defs>" +
      "<linearGradient id='timelineShine' x1='0%' y1='0%' x2='0%' y2='100%'>" +
      "  <stop offset='0%' style='stop-color:white;stop-opacity:.5'/>" +
      "  <stop offset='100%' style='stop-color:white;stop-opacity:.2'/>" +
      "</linearGradient></defs>";
    paths += "<path style='pointer-events: none' d='" + glow + "' fill='url(#timelineShine)'/>";

    var path = new Path();
    for (var i = 0; i < numberUnits; i++)
      path.rect(i * pixelsPerUnit, 0, pixelsPerUnit, rect.height);
    path.rect(i * pixelsPerUnit, 0,
              rect.width - pixelsPerUnit * 10, rect.height);
    paths += "<path style='pointer-events: none' clip-path='url(#borderClip)' d='" + path + "' stroke='rgba(0, 0, 0, .3)' fill='none' stroke-width='.6px'/>";

    var rectParts = "style='pointer-events: none' x='3' y='3' width='" + (rect.width - 6) + "px' height='" +
      (rect.height - 6) + "' rx='5' ry='5'";
    var rectSvg = "<rect " + rectParts +
      " stroke='#222' stroke-width='1.25px' fill='none'/>";

    paths += rectSvg + "<clipPath id='borderClip'><rect " + rectParts + "/></clipPath>";
    
    node.innerHTML = "<svg>" + paths + "</svg><div class='caption'><div class='timeline-arrow'></div></div><div class='timeline-text'><div></div></div>";
    node.firstChild.style.width = rect.width + "px";
    node.firstChild.style.height = rect.height + "px";
    node.classList.add("active");
    this.node = node;
  },

  totalTime: function() {
    return this.entries.reduce(function(a, b) {
      return a + b.value;
    }, 0);
  },

  filter: function(by) {
    if (typeof by == "string") {
      var entries = this.entries.filter(function(entry) {
        return entry.label == by;
      });
      return new Timeline(entries, this.node);
    } else if (typeof by == "number" && by >= 0 && by < this.entries.length) {
      return new Timeline([this.entries[by]], this.node);
    } else if (by.nodeType) {
      var nodes = document.querySelectorAll("g");
      var entries = [];
      var index = [].indexOf.call(nodes, by.parentNode);
      if (index != -1)
        entries.push(this.entries[index]);
      return new Timeline(entries, this.node);
    }

    return new Timeline([], this.node);
  },

  labels: function() {
    var labels = {};
    var entries = this.entries;
    for (var i = 0; i < entries.length; i++)
      labels[entries[i].label] = 1;
    return Object.keys(labels);
  },

  labelled: function() {
    var index = this._arrowNode().dataset.shownIndex;
    var entries = [];
    if (index && index !== -1)
      entries.push(this.entries[index]);
    return new Timeline(entries, this.node);
  },

  unload: function() {
    this.node = null;
  },

  json: function() {
    if (this.entries.length === 0)
      return null;
    return this.entries[0];
  },

  color: function() {
    if (this.entries.length === 0)
      return null;
    var nodes = document.querySelectorAll("g");
    return nodes[this.json().index].firstChild.getAttribute('fill');
  },

  _arrowNode: function() {
    return this.node.lastChild.previousSibling;
  },

  _textNode: function() {
    return this.node.lastChild.firstChild;
  },

  showLabel: function(label) {
    if (this.entries.length === 0)
      return;

    label = label || this.json().valueLabel;
    var entry = this.entries[0];
    var node = this._arrowNode();
    if (node.dataset.shownIndex == entry.index)
      return;

    node.style.left = entry.left + "px";
    var width = Math.max(1, entry.right - entry.left);
    node.style.width = width + "px";
    node.style.maxWidth = width + "px";
    node.dataset.shownIndex = entry.index;
    node.classList.add("visible");
    setTimeout(function() {
      if (parseInt(node.dataset.shownIndex) !== entry.index)
        return;
      node.classList.add("transitioning");
    }, 0);

    var textNode = this._textNode();
    textNode.innerHTML = label;
    textNode.parentNode.style.width = "1000px";
    textNode.parentNode.style.left = ((entry.left + entry.right) / 2 - 500) + "px";
  },

  _transitionEnd: function _transitionEnd(ev) {
    var node = ev.target;
    if (node.firstChild || parseInt(node.parentNode.dataset.shownIndex) !== -1)
      return;
    node = node.parentNode;
    var entry = this.entries[0];
    node.removeEventListener("transitionend", _transitionEnd, false);
    node.classList.remove("transitioning");
    node.style.removeProperty("left");
    node.style.removeProperty("width");
    node.style.removeProperty("max-width");
  },

  hideLabel: function() {
    var node = document.querySelector("div.caption");
    node.dataset.shownIndex = -1;
    node.classList.remove("visible");
    node.addEventListener("transitionend", this._transitionEnd, false);
    this._textNode().innerHTML = "";
  }
};

window.timeline = function(node) {
  var result = new Timeline(entriesFromNode(node), node);
  result._constructSVG();
  return result;
};

})();
