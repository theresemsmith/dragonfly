﻿window.templates || (window.templates = {});

(function(templates) {

const MIN_BAR_WIDTH = 22; // todo: this is 16 + 6 padding from network-graph-sections-hitarea, should be done separately
const TIMELINE_MARKER_WIDTH = 60;

templates.network_options_main = function(nocaching, tracking, headers, overrides)
{
  return ["div",
          ["div",
           ["h2", ui_strings.S_NETWORK_CACHING_SETTING_TITLE],
           ["p", ui_strings.S_NETWORK_CACHING_SETTING_DESC],
           ["p", ["label",
            ["input", "type", "checkbox",
             "name", "network-options-caching",
             "handler", "network-options-toggle-caching",
             "checked", nocaching ? true : false
            ],
            ui_strings.S_NETWORK_CACHING_SETTING_DISABLED_LABEL
           ]],
           ["h2", ui_strings.S_NETWORK_CONTENT_TRACKING_SETTING_TITLE],
           ["p", ui_strings.S_NETWORK_CONTENT_TRACKING_SETTING_DESC],
           ["p", ["label",
            ["input", "type", "checkbox",
             "name", "network-options-track-bodies",
             "handler", "network-options-toggle-body-tracking",
             "checked", tracking ? true : false
            ],
            ui_strings.S_NETWORK_CONTENT_TRACKING_SETTING_TRACK_LABEL
           ]],
           ["h2", ui_strings.S_NETWORK_HEADER_OVERRIDES_TITLE],
           ["p", ui_strings.S_NETWORK_HEADER_OVERRIDES_DESC],
           ["p", ["label", ["input", "type", "checkbox", "handler", "toggle-header-overrides"].concat(overrides ? ["checked", "checked"] : []), ui_strings.S_NETWORK_HEADER_OVERRIDES_LABEL],
            templates.network_options_override_list(headers, overrides)
           ]
          ],
         "class", "network-options"
         ];
};

templates.network_options_override_list = function(headers, overrides)
{
  var tpl = ["_auto_height_textarea",
             headers.map(function(e) {return e.name + ": " + e.value}).join("\n"),
             "class", "header-override-input"
            ].concat(overrides ? [] : ["disabled", "disabled"]);
  return [
          ["br"],
          ui_strings.S_NETWORK_HEADER_OVERRIDES_PRESETS_LABEL + ":", templates.network_options_override_presets(overrides),
          ["br"],
          tpl,
          ["br"],
          ["span", ui_strings.S_NETWORK_HEADER_OVERRIDES_PRESETS_SAVE,
           "handler", "update-header-overrides",
           "class", "container-button ui-button",
           "tabindex", "1"
          ].concat(overrides ? [] : ["disabled", "disabled"])
         ];
};

templates.network_options_override_presets = function(overrides)
{
    return ["select",
            cls.ResourceUtil.header_presets.map(function(e) { return ["option", e.name, "value", e.headers] }),
            "handler", "network-options-select-preset"
            ].concat(overrides ? [] : ["disabled", "disabled"]);
};

templates.network_request_crafter_main = function(url, loading, request, response)
{
  // fixme: replace request in progress text with spinner or similar.
  return ["div",
          ["div",
           ["h2", ui_strings.S_HTTP_LABEL_URL],
           ["p", ["input", "type", "text",
            "value", url || "http://example.org",
            "handler", "request-crafter-url-change"]],
           ["h2", ui_strings.M_NETWORK_CRAFTER_REQUEST_BODY],
            ["p", ["_auto_height_textarea", request]],
           ["p", ["span", ui_strings.M_NETWORK_CRAFTER_SEND,
            "handler", "request-crafter-send",
            "unselectable", "on",
            "class", "container-button ui-button",
            "tabindex", "1"]],
           ["h2", ui_strings.M_NETWORK_CRAFTER_RESPONSE_BODY],
           ["p", ["textarea", loading ? ui_strings.M_NETWORK_CRAFTER_SEND : response]],
           "class", "padding request-crafter"
          ]
         ];
};

templates.network_incomplete_warning = function()
{
  return ["div",
           [
             ["span", "This only shows resources that were loaded while Dragonfly was open. "], ["span", "Reload", "class", "text_handler", "handler", "reload-window"], ["span", " to see the complete page-load. "],
             ["span", "Don't show again", "class", "text_handler", "handler", "turn-off-incomplete-warning"],
             ["span", " ", "class", "close_incomplete_warning", "handler", "close-incomplete-warning"]
           ],
         "class", "network_incomplete_warning"];
};

templates.network_log_main = function(ctx, selected, selected_viewmode, detail_width, item_order)
{
  var viewmode_render = templates["network_viewmode_" + selected_viewmode];
  if (!viewmode_render)
    viewmode_render = templates["network_viewmode_graphs"];

  var show_incomplete_warning = settings.network_logger.get("show-incomplete-warning") &&
                                !ctx.saw_main_document_abouttoloaddocument &&
                                !ctx.incomplete_warn_discarded;

  return [
    show_incomplete_warning ?
    templates.network_incomplete_warning() : [],
    [
      "div", templates.network_log_url_list(ctx, selected, item_order),
      "id", "network-url-list"
    ],
    [
      "div", [
        "div", viewmode_render(ctx, detail_width),
        "class", "network-data-container " + selected_viewmode
      ],
      "class", "network-detail-container"
    ]
  ]
};

templates.network_viewmode_graphs = function(ctx, width)
{
  var basetime = ctx.get_starttime();
  var duration = ctx.get_coarse_duration(MIN_BAR_WIDTH, width);
  var rows = templates.network_graph_rows(ctx, width, basetime, duration);

  var template = [];
  if (duration)
  {
    var stepsize = templates.grid_info(duration, width, (TIMELINE_MARKER_WIDTH / 2) + MIN_BAR_WIDTH);
    var gridwidth = Math.round((width / duration) * stepsize);
    var headerrow = templates.network_timeline_row(width, stepsize, gridwidth);

    var domcontentloaded = -1;
    var load = -1;
    // place the domcontentloaded and load events if available
    // todo: very much work in progress
    if (ctx.saw_main_document_abouttoloaddocument)
    {
      var first_document_id = ctx.get_entries().map(function(entry){return entry.document_id})[0];
      // todo: an initial redirect look like the top document, but it's not. no notifications are shown then.
      var notifications = ctx._document_notifications[first_document_id];
      if (notifications)
      {
        var scale = width / duration;
        if (notifications["DOMCONTENTLOADED_START"])
        {
          domcontentloaded = (notifications["DOMCONTENTLOADED_START"].time - basetime) * scale;
          // console.log("DOMCONTENTLOADED_START of main resource:", notifications["DOMCONTENTLOADED_START"].time - basetime, "after basetime");
        }
        if (notifications["LOAD_START"])
        {
          load = (notifications["LOAD_START"].time - basetime) * scale;
          // console.log("LOAD_START of main resource:", notifications["LOAD_START"].time - basetime, "after basetime");
        }
      }
    }

    template = ["div", headerrow, rows,
                  "id", "graph",
                  "style", ["background-image: -o-linear-gradient(",
                                               "0deg,",
                                               "#e5e5e5 0px,",
                                               "#e5e5e5 1px,",
                                               "transparent 1px",
                                              "),",
                                              "-o-linear-gradient(",
                                               "0deg,",
                                               "#5acaec 0px,",
                                               "#5acaec 1px,",
                                               "transparent 1px",
                                              "),",
                                              "-o-linear-gradient(",
                                               "0deg,",
                                               "#64b56b 0px,",
                                               "#64b56b 1px,",
                                               "transparent 1px",
                                              ");",
                           "background-position: -1px 21px, ",
                            domcontentloaded + "px 21px,",
                            load + "px 21px;",
                           "background-repeat: repeat-x, no-repeat, no-repeat;",
                           "background-size: " + gridwidth + "px 100%;"].join("")
               ];
  }
  return template;
}

templates.network_viewmode_data = function(ctx, detail_width)
{
  return ["div", "class", "network-data-table-container"];
}

templates.network_log_url_list = function(ctx, selected, item_order)
{
  var itemfun = function(req)
  {
    var error_responses = /5\d{2}|4\d{2}/;
    var had_error_response = error_responses.test(req.responsecode);
    var disqualified = !req.touched_network || req.unloaded;

    var url_tooltip = req.human_url;
    var context_info;
    if (req.unloaded)
      context_info = "Unloaded"; // todo: strings
    else if (req.cached)
      context_info = "Cached";
    else if (had_error_response)
      context_info = req.responsecode + " (" + cls.ResourceUtil.http_status_codes[req.responsecode] + ")";

    if (context_info)
      url_tooltip = context_info + " - " + url_tooltip;

    return ["li",
            templates.network_request_icon(req),
            ["span",
              req.filename || req.human_url,
              "data-tooltip-text" , url_tooltip,
              "data-tooltip", "network-url-list-tooltip"
            ],
            "handler", "select-network-request",
            "data-object-id", String(req.id),
            "class", (selected === req.id ? "selected" : " ") + (had_error_response ? "error" : " ") + (disqualified ? "disqualified" : "")
           ];
  };

  var items = ctx.get_entries_filtered().slice(0);
  // Could use copy_object instead, because the template doesn't need the methods of the resources.
  // But it's probably more overhead to copy the whole thing then it is to just make a new array pointing
  // to the old objects
  if (item_order)
  {
    item_order = item_order.split(",");
    items.sort(function(a, b)
      {
        var ind_a = item_order.indexOf(a.id);
        var ind_b = item_order.indexOf(b.id);

        if (ind_a === ind_b)
          return 0;

        if (ind_a > ind_b)
          return 1;

        return -1;
      }
    );
  }
  return [
    ["ol", items.map(itemfun),
      "class", "network-log-url-list"]
  ]
};

templates.network_request_icon = function(request)
{
  var classname = "resource-icon resource-type-" + request.type;
/*
  // todo: long lasting discussion to add some XHR indicator to the icon
  if (request.load_origin) // === "xhr"
    classname += " request-origin-" + request.load_origin;
*/
  return ["span", "class", classname];
};

templates.network_timeline_row = function(width, stepsize, gridwidth)
{
  var labels = [];
  var cnt = Math.ceil(width / gridwidth);
  var offset = -1; // background-position in #graph is adjusted by that, to hide the 0s line
  var max_val = stepsize * cnt;
  var unit = [1, "ms"];
  if (max_val > 1000)
    unit = [1000, "s"];
  
  while (stepsize && --cnt > 0) // skips last one on purpose (0s marker)
  {
    var left_val = gridwidth * cnt - TIMELINE_MARKER_WIDTH / 2 + offset;
    var val_str = (stepsize * cnt) / unit[0];
    val_str = Math.round(val_str * 100) / 100;
    labels.push(["span", "" + val_str + unit[1],
                 "style", "left: " + left_val + "px;",
                 "class", "timeline-marker"
                 ]);
  }

  return ["div", labels, "class", "network-timeline-row"];
};

templates.network_graph_rows = function(ctx, width, basetime, duration)
{
  var tpls = [];
  var entries = ctx.get_entries_filtered();

  for (var n = 0, entry; entry = entries[n]; n++)
  {
    tpls.push(templates.network_graph_row(entry, width, basetime, duration));
  }
  return tpls;
};

// gap_def format: 
/* {
     "classname": "type of sequence",
     "sequences": {
       "from_event_name": [
         "to_event_name_one",
         "to_event_name_two"
       ]
     }
   } */

templates.network_gap_defs = [
  {
    classname: "blocked",
    sequences: {
      "urlload": [
        "request",
        "urlredirect",
        "urlfinished"
      ],
      "responseheader": [
        "urlredirect",
        "requestretry"
      ],
      "requestfinished": [
        "requestretry",
        "responsefinished"
      ],
      "requestretry": [
        "request"
      ],
      "responsefinished": [
        "urlfinished",
        // responsefinished can occur twice, see CORE-43284.
        // This is fixed and stops showing up when integrated.
        "responsefinished"
      ],
      "urlredirect": [
        "urlfinished",
        "responsefinished"
      ]
    }
  },
  {
    classname: "request",
    sequences: {
      "request": ["requestheader"],
      "requestheader": ["requestfinished"]
    }
  },
  {
    classname: "waiting",
    sequences: {
      "requestfinished": [
        "response",
        // The response-phase can be closed without ever seeing a response event, for 
        // example because the request was aborted. See CORE-43284.
        "responsefinished"
      ],
      "responseheader": [
        // Occurs when a 100-Continue response was sent. In this timespan the client has
        // ignored it and waits for another response to come in. See CORE-43264.
        "response"
      ]
    }
  },
  {
    classname: "receiving",
    sequences: {
      "response": ["responseheader"],
      "responseheader": ["responsefinished"]
    }
  }
];
templates.network_error_store = {};

templates.network_get_event_gaps = function(events)
{
  var gap_defs = templates.network_gap_defs;

  var event_gaps = [];
  // todo: do this when we see the network event, with just that one.
  for (var i = 0; i < events.length - 1; i++)
  {
    var from_event = events[i];
    var to_event = events[i + 1];
    var gap_def = gap_defs.filter(function(def){
      return def.sequences[from_event.name] &&
             def.sequences[from_event.name].contains(to_event.name);
    })[0];

    var classname = gap_def && gap_def.classname;
    if (!classname)
    {
      classname = "unexpected_network_event_sequence";
      var error_str = ui_strings.S_DRAGONFLY_INFO_MESSAGE +
            "Unexpected event sequence between " + from_event.name + " and " + to_event.name + " (" + (to_event.time - from_event.time) + "ms spent)";
      if (!templates.network_error_store[error_str])
      {
        opera.postError(error_str);
        templates.network_error_store[error_str] = true;
      }
    }
    event_gaps.push({
      classname: classname,
      val: to_event.time - from_event.time,
      from_event: from_event.name,
      to_event: to_event.name,
      val_string: new Number((to_event.time - from_event.time).toFixed(2)) + "ms"
    });
  }
  return event_gaps;
}

templates.network_graph_row = function(entry, width, basetime, duration)
{
  var scale = width / duration;
  var start = (entry.starttime - basetime) * scale;
  var padding_left_hitarea = 3;
  var item_container = ["span",
                        templates.network_graph_sections(entry, width, duration),
                        "class", "network-graph-sections-hitarea",
                        "data-tooltip", "network-graph-tooltip",
                        "style", "margin-left:" + (start - padding_left_hitarea) + "px;"];

  return ["div", item_container,
          "class", "network-graph-row",
          "handler", "select-network-request",
          "data-object-id", String(entry.id)];
}

templates.network_graph_sections = function(entry, width, duration)
{
  var scale = width / duration;
  var gaps = templates.network_get_event_gaps(entry.events, false);
  var sections = gaps.map(function(section){
      return [
        "span",
        "class", "network-section network-" + section.classname,
        "style", "width:" + (section.val || 0) * scale + "px;"
      ];
  });

  return ["span", sections,
           "class", "network-graph-sections",
           "data-tooltip", "network-graph-tooltip", // the tooltip is now on the sections and the hitarea.
           "data-object-id", String(entry.id)
         ];
};

templates.network_graph_entry_tooltip = function(entry)
{
  if (!entry)
    return;

  const height = 165;
  var duration = entry.get_duration();
  if (duration && entry.events)
  {
    var graphical_sections = [];
    var scale = height / duration;
    var total_length_string = new Number(duration).toFixed(2) + "ms";

    var gaps = templates.network_get_event_gaps(entry.events);
    gaps.map(function(section){section.px = section.val * scale});
    gaps.forEach(function(section){
      if (section.val)
      {
        graphical_sections.push([
          "div",
          "class", "network-tooltip-section network-" + section.classname,
          "style", "height:" + section.px + "px;"
        ]);
      }
    });

    var event_name_map = {
      "urlload": "URL started",
      "request": "Request started",
      "requestheader": "Request headers written",
      "urlredirect": "Redirected",
      "requestretry": "Request retried",
      "requestfinished": "Request finished",
      "response": "Response started",
      "responseheader": "Response header written",
      "responsefinished": "Response phase finished",
      "urlfinished": "URL completed"
    };

    var previous_event_ms;
    var event_rows = gaps.map(function(gap, index, arr)
    {
      return [
               ["tr", 
                 ["td", gap.val_string, "class", "time_data mono"], ["td", event_name_map[gap.from_event], "class", "event_name"]
               ],
               arr.length - 1 === index ? ["tr",["td"], ["td", event_name_map[gap.to_event], "class", "event_name"]] : []
             ];
    });

    const CHARWIDTH = 7; // todo: we probably have that around somewhere where its dynamic
    var svg_width = 100.5;

    var pathes = [];
    var x_start = 1.5;
    var y_start = 0.5;
    var y_ref = 0;
    var x_end = svg_width;

    entry.events.forEach(function(ev, index) {
      if (!index) // todo: omg fix it!
      {
        pathes.push([]);
      }
      else
      {
        if (pathes.length)
        {
          var event_height = Math.round(gaps[pathes.length - 1].px);
          y_start = y_ref + (event_height / 2);
          y_ref += event_height;
        }
        var y_end = (pathes.length * 19) - 2;
        pathes.push(["path", "d", "M" + x_start + " " + y_start + " L" + x_end + " " + y_end, "stroke", "#BABABA"]);
      }
    });
    var svg_height = Math.max(y_start, y_end, y_ref);

    return ["div",
      [
        /*
        ini.debug ?
          ["h2", "Requested " + entry.resource + " at " +  entry.start_time_string] : ["h2", "Requested at " +  entry.start_time_string], */
        ["div",
          ["div",
            ["div", graphical_sections, "class", "network-tooltip-graph-sections"],
            "class", "network-tooltip-graph"
          ],
          ["div", 
            ["svg:svg", pathes,
              "width",  Math.ceil(svg_width) + "px",
              "height", Math.ceil(svg_height) + "px",
              "version", "1.1",
              "style", "position: absolute;"
            ], "class", "network-tooltip-pointers"],
          ["div",
            ["table", event_rows],
            "class", "network-tooltip-legend"
          ],
        "class", "network-tooltip-row"]
      ], "class", "network-tooltip-container"
    ];
  }
}


templates.grid_info = function(duration, width, padding)
{
  if (duration > 0)
  {
    var draw_line_every = 150; // px
    var draw_lines = Math.round(width / draw_line_every);
    
    var value = oldval = Number(Number(duration / draw_lines).toPrecision(1)); // what this returns is the duration of one section
    var val_in_px = width / duration * Number(value);

    // if the last line comes too close to the edge, the value until it fits.
    // need to modify the actual ms value to keep it nice labels on the result,
    // at least while it gets shown in ms
    while (width % (val_in_px * draw_lines) < padding)
    {
      value--;
      val_in_px = width / duration * value;
    }

    return value;
  }
}

})(window.templates);