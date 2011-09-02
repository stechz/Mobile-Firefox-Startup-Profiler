Introduction
============

This project allows you to understand what mobile Firefox is doing during
startup by breaking it up into intervals of time parsed from a special log
file.

In order to generate a log file, do the following:
1. You currently need to rebuild fennec to generate logs. Apply the patch in
   [bug 675233](https://bugzilla.mozilla.org/show_bug.cgi?id=675233) and
   add `--enable-functiontimer` to your `.mozconfig` file. There may also be
   a build available in the bug.
2. Install the package. If you want to get a good measurement of cold startup,
   I suggest you open Fennec once, go to another application and make sure
   Fennec is killed in the background.
3. When you are ready to profile, type `adb logcat -c` to clear the log output.
4. Type `adb logcat > log.txt` and then open Fennec.
5. After Fennec has startup up, press CTRL-C to end `logcat`. I wouldn't leave
   the log on for very long after startup is done because it may bring this
   parser to its knees.

You may then use `timeline.html` to parse the log and inspect your collected
data.

Note that this was primarily designed for Firefox. I'd appreciate patches to
get the parser working in other browsers that support the HTML5 FileReader API.

Moving around the interface
===========================

The first thing you will do is "upload" the file. There is no server needed for
this. If you want to see the interface without all the muss and fuss, try out
`example-log.html`.

You will then see a timeline, if everything goes correctly. You can tap
anywhere on the timeline to inspect a specific event. All instances of the
event will be presented below the timeline as boxes, the earliest of the events
starting at the top left of the area and moving right and then down.  You can
tap a box to see where it is located on the timeline.

On the right hand side, you will notice several items.
* `Log View` allows you to take a selection and see where it came from in the
  log. Click it to see. Click it again to go back to timeline view.
* `Save Timeline As...` allows you to bundle up all the log data and
  HTML/CSS/JS into one file. Useful if you want to share your log!
* `Details` tells you a bit about the displayed timeline.
* `Legend` can help you find specific types of messages that may be hard to
  discover from perusing the timeline.
* `Options` allows you to filter the logfile to produce different timelines.

Contribution
============

A small tour of the code so far:
* All the tests follow the pattern `*.test.js`
* `timeline.html`: The glue that holds it all together.
* `startup.js`: Code specific to timeline.html.
* `logparser.js`: Code that parses the log output.
* `timeline.js`: Mostly generic code for making pretty timelines for any data.
* `test.js`: Small unit-testing framework. Press F8 to see the tests runs when
  you are on timeline.html. If there are errors, opening a console will let
  you see what went wrong.

Most of the code was hacked together in a rush and definitely fits into
"prototype" status. Patches definitely welcome!

TODO List
=========

P1: High Priority
-----------------
* Incorporate function timers into Fennec itself so that anyone would be able
  to examine their startup info.
* Filter for including to session restore event.
* Performance is sometimes very bad and this parser is a memory hog. Most
  everything except `logparser.js` and `test.js` could use a rewrite.

P2: Lower Priority
------------------
* Allow for hierarchical messages ("Layout", "Gfx", "Javascript", etc.)
* There is currently no way to upload a new log file.
* Would be nice to see units across the timeline.
* Bug: resizing window messes up layout in many, many ways

Contributors
============

* [Benjamin Stover](http://stechz.com/)

If you are interested in owning and driving this project, please get in touch!

Special Thanks
==============

* [Mozilla](http://mozilla.org/) for the excellent MDC documentation and for
  the gradient idea seen on about:home! :)
