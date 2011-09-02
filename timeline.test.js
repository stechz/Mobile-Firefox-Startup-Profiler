test({
  timelineHTML: [
    "<timeline>",
    "  CSS parsing: 100ms,",
    "  Unknown: 900ms,",
    "  CSS parsing: 10ms",
    "</timeline>"
  ].join("\n"),

  setup: function() {
    document.body.innerHTML = this.timelineHTML;
    this.timeline = timeline(document.body.firstChild);
  },

  teardown: function() {
    this.timeline.unload();
    this.timeline = null;
  },

  testTimeline: function() {
    var timeline = this.timeline;
    test.is(timeline.totalTime(), 1010);
    test.is(timeline.filter("CSS parsing").totalTime(), 110);
  },

  // Ensure setTimeout trickery doesn't fool the functions themselves.
  testLabelIsHidden: function() {
    var timeline = this.timeline;
    timeline.filter("CSS parsing").showLabel();
    timeline.hideLabel();
    test.waitForTimeout(10, function() {
      var list = document.querySelector("div.caption").classList;
      test.ok(!list.contains("visible"), "List is still visible");
    });
  }
});
