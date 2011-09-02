(function () {

var rawText =
"I/Gecko   ( 3425): [default    278.00] > (  3)   |nsresult nsComponentManagerImpl::Init() (line 334)\n" +
"I/Gecko   ( 3425): nsComponentManagerImpl Next: init component manager arena 1314831996331572\n" +
"I/Gecko   ( 3425): nsComponentManagerImpl Next: init native module loader 1314831996331913\n" +
"I/Gecko   ( 3425): [default    284.00] > (  4)    |?MINMS virtual nsresult nsComponentManagerImpl::CreateInstance(const nsCID&, nsISupports*, const nsIID&, void**) (line 1172) (cid: {7526a738-9632-11d3-8cd9-0060b0fc14a3})\n" +
"I/Gecko   ( 3425): [default    284.00] < (  4)    |<MINMS      0.00 ms (     0.00 ms total) - virtual nsresult nsComponentManagerImpl::CreateInstance(const nsCID&, nsISupports*, const nsIID&, void**) (line 1172) (cid: {7526a738-9632-11d3-8cd9-0060b0fc14a3})\n" +
"I/Gecko   ( 3425): [default    285.00] > (  5)     |?MINMS virtual nsresult nsComponentManagerImpl::GetServiceByContractID(const char*, const nsIID&, void**) (line 1655) (contractid: @mozilla.org/observer-service;1)\n" +
"I/Gecko   ( 3425): [default    285.00] > (  6)      |?MINMS virtual nsresult nsComponentManagerImpl::CreateInstanceByContractID(const char*, nsISupports*, const nsIID&, void**) (line 1256) (contractid: @mozilla.org/observer-service;1)\n" +
"I/Gecko   ( 3425): about to make factory @mozilla.org/observer-service;1 1314831996338548\n" +
"I/Gecko   ( 3425): [default    285.00] < (  6)      |<MINMS      0.00 ms (     0.00 ms total) - virtual nsresult nsComponentManagerImpl::CreateInstanceByContractID(const char*, nsISupports*, const nsIID&, void**) (line 1256) (contractid: @mozilla.org/observer-service;1)\n" +
"I/Gecko   ( 3425): [default    285.00] < (  5)     |<MINMS      0.00 ms (     0.00 ms total) - virtual nsresult nsComponentManagerImpl::GetServiceByContractID(const char*, const nsIID&, void**) (line 1655) (contractid: @mozilla.org/observer-service;1)\n" +
"I/Gecko   ( 3425): [default    285.00] > (  5)     |?MINMS virtual nsresult nsComponentManagerImpl::GetServiceByContractID(const char*, const nsIID&, void**) (line 1655) (contractid: @mozilla.org/xre/app-info;1)\n" +
"I/Gecko   ( 3425): [default    285.00] > (  6)      |?MINMS virtual nsresult nsComponentManagerImpl::CreateInstanceByContractID(const char*, nsISupports*, const nsIID&, void**) (line 1256) (contractid: @mozilla.org/xre/app-info;1)\n" +
"I/Gecko   ( 3425): [default    440.00] > (  5)     |gfx/info\n" +
"I/Gecko   ( 3425): [default    480.00] > (  5)     |nsXBLProtoImplMethod::CompileMember\n" +
"I/Gecko   ( 3425): [default    490.00] < (  5)     |nsXBLProtoImplMethod::CompileMember\n" +
"I/Gecko   ( 3425): [default    500.00] < (  5)     |gfx/init\n" +
"I/Gecko   ( 3425): [default    520.00] > (  5)     |InitialReflow\n" +
"I/Gecko   ( 3425): [default    530.00] > (  5)     |nsXBLProtoImplMethod::CompileMember\n" +
"I/Gecko   ( 3425): [default    540.00] < (  5)     |nsXBLProtoImplMethod::CompileMember\n" +
"I/Gecko   ( 3425): [default    550.00] < (  5)     |InitialReflow\n" +
"I/Gecko   ( 3425): [default    595.00] > (  6)      |?MINMS PresShell::Paint\n" +
"I/Gecko   ( 3425): [default    800.00] > (  6)      |?MINMS virtual nsresult nsComponentManagerImpl::CreateInstanceByContractID(const char*, nsISupports*, const nsIID&, void**) (line 1256) (contractid: @mozilla.org/xre/app-info;1)\n";

var matches = logparser.linesToMatch(rawText.split("\n"));
var map = logparser.generateMap(matches, {
  "after-first-paint": false
});
var array = logparser.generateArray(map);

test({
  setup: function() {
    this._json = {};
  },

  testLinesToMatch: function() {
    test.ok([].constructor == matches.constructor, "matches is array");
    test.is(matches.length, 19, "unrelated lines to parser were filtered out");
    test.is(matches[0].time, 278, "time is correct");
    test.is(matches[0].openClose, ">", "openClose is correct");
    test.is(matches[0].data.indexOf("Init"), 33, "data looks correct");
  },

  testGenerateMap: function() {
    function eventIsThere(message, begin, end) {
      test.is(map[begin][0].type, "begin");
      test.is(map[begin][0].message, message);
      test.is(map[end][0].type, "end");
      test.is(map[end][0].message, message);
    }

    eventIsThere("Before component manager is initialized", 0, 278);
    eventIsThere("gfx: Loading fonts", 440, 500);
    eventIsThere("Javascript", 480, 490);
    eventIsThere("layout: InitialReflow", 520, 550);
    eventIsThere("Javascript", 530, 540);
    test.is(map[595][0].message, "End");
    var keys = Object.keys(map);
    test.is(keys.length, 11, "Size of map is correct");
  },

  testGenerateMapWithAfterPaint: function() {
    var map = logparser.generateMap(matches, {
      "after-first-paint": true
    });
    test.is(map[595], undefined);
    test.is(map[800][1].type, "end");
    test.is(map[800][1].message, "End");
    var keys = Object.keys(map);
    test.is(keys.length, 11, "Size of map is correct");
  },

  testGenerateArray: function() {
    function eventIsThere(i, duration, message) {
      test.is(array[i].duration, duration, "Time is correct");
      test.is(array[i].message, message, "Message is correct");
    }

    test.is(array.length, 8, "Size of events array is correct");
    eventIsThere(0, 278, "Before component manager is initialized");
    eventIsThere(1, 162, "Unclassified");
    eventIsThere(2, 60, "gfx: Loading fonts");
    eventIsThere(3, 20, "Unclassified");
    eventIsThere(4, 10, "layout: InitialReflow");
    eventIsThere(5, 10, "Javascript");
    eventIsThere(6, 10, "layout: InitialReflow");
    eventIsThere(7, 45, "Unclassified");
  },

  _makeEvent: function(message, index, begin, end) {
    var json = this._json;
    if (json[begin] === undefined)
      json[begin] = [];
    if (json[end] === undefined)
      json[end] = [];

    json[begin].push({
      message: message,
      type: "begin",
      registrar: { index: index }
    });
    json[end].push({
      message: message,
      type: "end",
      registrar: { index: index }
    });
  },

  testGenerateArraySameIndex: function() {
    var makeEvent = this._makeEvent;
    makeEvent("Layout: One thing", 1, 0, 200);
    makeEvent("Layout: Number two", 1, 50, 150);
    var array = logparser.generateArray(this._json);

    function eventIsThere(i, duration, message) {
      test.is(array[i].duration, duration, "Time is correct");
      test.is(array[i].message, message, "Message is correct");
    }
    eventIsThere(0, 50, "Layout: One thing");
    eventIsThere(1, 100, "Layout: Number two");
    eventIsThere(2, 50, "Layout: One thing");
  },

  testGenerateArraySameEnd: function() {
    var makeEvent = this._makeEvent;
    makeEvent("Layout: One thing", 1, 0, 200);
    makeEvent("Layout: Number two", 1, 50, 200);
    makeEvent("End", 2, 500, 500);
    var array = logparser.generateArray(this._json);

    function eventIsThere(i, duration, message) {
      test.is(array[i].duration, duration, "Time is correct");
      test.is(array[i].message, message, "Message is correct");
    }
    eventIsThere(0, 50, "Layout: One thing");
    eventIsThere(1, 150, "Layout: Number two");
    eventIsThere(2, 300, "Unclassified");
  },

  testGenerateArraySameEndAsBegin: function() {
    // XXX fixme

    var makeEvent = this._makeEvent;
    makeEvent("Layout: One thing", 1, 0, 100);
    makeEvent("Layout: One thing", 1, 100, 200);
    makeEvent("End", 2, 500, 500);
    var array = logparser.generateArray(this._json);

    function eventIsThere(i, duration, message) {
      test.is(array[i].duration, duration, "Time is correct");
      test.is(array[i].message, message, "Message is correct");
    }
    eventIsThere(0, 200, "Layout: One thing");
    console.log(array.length, 2, "There are not extra items");
  }
});

})();
