window.cls = window.cls || (window.cls = {});

/**
 * @constructor
 * @extends ViewBase
 */

cls.ReplView = function(id, name, container_class, html, default_handler) {
  this._resolver = new cls.PropertyFinder();
  this._data = new cls.ReplData(this);
  this._service = new cls.ReplService(this, this._data);
  this._linelist = null;
  this._textarea = null;
  this._lastupdate = null;
  this._current_input = "";
  this._current_scroll = 0;
  this._container = null;
  this._backlog_index = -1;


  this.ondestroy = function()
  {
    this._lastupdate = 0;
    this._backlog_index = -1;
    this._current_scroll = this._container.scrollTop;
    this._current_input = this._textarea.value;
  };

  this.createView = function(container)
  {
    var switched_to_view = false;
    if (!this._lastupdate)
    {
      container.innerHTML = "";
      container.render(templates.repl_main());
      this._linelist = container.querySelector("ol");
      this._textarea = container.querySelector("textarea");
      this._textarea.value = this._current_input;
      this._container = container;
      switched_to_view = true;
      // note: events are bound to handlers at the bottom of this class
    }


    var scroll_at_bottom = this._container.scrollTop + this._container.offsetHeight >= this._container.scrollHeight;
    this._update();

    opera.postError(scroll_at_bottom)
    if (this._current_scroll)
    {
      this._container.scrollTop = this._current_scroll;
      this._current_scroll = null;
    }
    else if (scroll_at_bottom)
    {
      this._container.scrollTop = 9999999; this._container.scrollHeight;
      if (switched_to_view) {
        window.setTimeout(function() {this._textarea.focus();}.bind(this), 100);
      }
    }

    return;
  };


  this.clear = function()
  {
    this.ondestroy();
  };

  /**
   * Pulls all the available, non-rendered, events from the data
   * object and renders them
   */
  this._update = function()
  {
    var now = new Date().getTime();
    var entries = this._data.get_log(this._lastupdate);
    this._lastupdate = now;

    for (var n=0, e; e=entries[n]; n++)
    {
      switch(e.type) {
        case "input":
          this._render_input(e.data);
          break;
        case "string":
          this._render_string(e.data);
          break;
        case "exception":
          this._render_error(e.data);
          break;
        case "iobj":
          this._render_inspectable_object(e.data);
          break;
        case "iele":
          this._render_inspectable_element(e.data);
          break;
        case "pobj":
          this._render_pointer_to_object(e.data);
          break;
        case "valuelist":
          this._render_value_list(e.data);
          break;
        case "trace":
          this._render_trace(e.data);
          break;
        case "groupstart":
          this._render_groupstart(e.data);
          break;
        case "groupend":
          this._render_groupend();
          break;
      default:
          this._render_string("unknown");
      }
    }
  };

  this._render_groupstart = function(data)
  {
    this._add_line([["button", "", "class", "folder-key"+(data.collapsed ? "" : " open" ),
                                   "handler", "repl-toggle-group"
                    ],
                    data.name]);
    var ol = document.createElement("ol");
    ol.className="repl-lines";
    this._add_line(ol);
    if (data.collapsed) {
      ol.parentNode.style.display = "none";
    }

    this._linelist = ol;
  };

  this._render_groupend = function()
  {
    if (this._linelist.parentNode.parentNode.nodeName.toLowerCase() == "ol")
    {
      this._linelist = this._linelist.parentNode.parentNode;
    }
  };

  this._render_pointer_to_object = function(data)
  {
    this._add_line(templates.repl_output_pobj(data));
  };

  this._render_inspectable_element = function(data)
  {
    if (!data.view) {
      var rt_id = data.rt_id, obj_id=data.obj_id, name=data.name;
      data.view = new cls.InspectableDomNodeView(rt_id, obj_id, name, false);
    }

    if (data.view && !data.view.expanded)
    {
      // re-enter once we have the data.
      data.view.expand(this._render_inspectable_element.bind(this, data));
      return;
    }

    this._add_line(data.view.render());
  };

  this._render_inspectable_object = function(data)
  {
    if (!data.view) {
      var rt_id = data.rt_id, obj_id=data.obj_id, name=data.name;
      data.view = new cls.InspectableObjectView(rt_id, obj_id, name, false);
    }

    if (data.view && !data.view.expanded)
    {
      // re-enter once we have the data.
      data.view.expand(this._render_inspectable_object.bind(this, data));
      return;
    }

    this._add_line(data.view.render());
  };

  this._render_error = function(data)
  {
    this._render_string(data.message, data.stacktrace);
  };

  this._render_trace = function(data)
  {
    this._add_line(templates.repl_output_trace(data));
  };

  this._render_value_list = function(values) {
    var tpl = values.map(templates.repl_output_native_or_pobj);
    var separated = [];
    separated.push(tpl.shift());
    while (tpl.length)
    {
      separated.push(["span", ", "]);
      separated.push(tpl.shift());
    }
    this._add_line(separated);
  };

  /**
   * Render an arbitrary numver of string arguments
   */
  this._render_string = function()
  {
    for (var n=0; n<arguments.length; n++)
    {
      this._add_line(templates.repl_output_native(arguments[n]));
    }
  };

  this._render_input = function(str)
  {
    this._render_string(">>> " + str);
  };

  this.set_current_input = function(str)
  {
    this._textarea.textContent = str;
  };

  this._add_line = function(elem_or_template)
  {
    var line = document.createElement("li");

    if (elem_or_template.nodeType === undefined)
    {
      line.render(elem_or_template);
    }
    else
    {
      line.appendChild(elem_or_template);
    }
    this._linelist.appendChild(line);
  };

  this._handle_keypress_bound = function(evt)
  {
    switch (evt.keyCode) {
      case 9: // tab
      {
        evt.preventDefault();
        this._resolver.find_props(this._handle_completer.bind(this),
                                  this._textarea.value,
                                  window.stop_at.getSelectedFrame());
        break;
      }
      case 13: // enter
      {
        // stop it from adding a newline just before processing. Looks strange
        evt.preventDefault();
        var input = this._textarea.value;
        input = input.trim();
        this._textarea.value = "";
        this._backlog_index = -1;
        this._current_input = "";

        if (input == "") {
          this._render_input("");
          return;
        }

        this._service.handle_input(input);
        break;
      }
      case 38: // up and down. maybe. See DSK-246193
      case 40:
      {
        // workaround as long as we don't have support for keyIdentifier
        // event.which is 0 in a keypress event for function keys
        if( !evt.which )
        {
          evt.preventDefault();
          this._handle_backlog(evt.keyCode == 38 ? 1 : -1);
        }
        break;
      }
    }
  }.bind(this);

  this._handle_backlog = function(delta)
  {
    this._set_input_from_backlog(this._backlog_index + delta);
  };

  this._set_input_from_backlog = function(index)
  {
    if (index <= -1)
    {
      this._backlog_index = -1;
      this._textarea.value = this._current_input;
      return;
    }

    if (this._backlog_index == -1)
    {
      this._current_input = this._textarea.value;
    }

    var log = this._data.get_typed_history();
    this._backlog_index = Math.min(index, log.length-1);
    var entry = log[this._backlog_index];

    if (entry != undefined)
    {
      this._textarea.value = entry;
    }
  };

  this._handle_completer = function(props)
  {
    var localpart = props.identifier;

    var matches = props.props.filter(function(e) {
      return e.indexOf(localpart) == 0;
    });

    if (! matches.length) {
      return;
    }

    var match = this._longest_common_prefix(matches.slice(0));
    if (match.length > localpart.length)
    {
      var pos = this._textarea.value.lastIndexOf(localpart);
      this._textarea.value = this._textarea.value.slice(0, pos) + match;
    }
    else
    {
      this._render_input(this._textarea.value);
      this._render_string(matches.sort().join(", "));
    }

  };

  /**
   * Return the longest common prefix of all the strings in the array
   * of strings. For example ["foobar", "foobaz", "foomatic"] -> "foo"
   */
  this._longest_common_prefix = function(strings)
  {
    if (strings.length == 0)
    {
      return "";
    }
    else if (strings.length == 1)
    {
      return strings[0];
    }
    else
    {
      var sorted = strings.slice(0).sort();
      var first = sorted.shift();
      var last = sorted.pop();

      for (var n=last.length; n; n--)
      {
        if (first.indexOf(last.slice(0,n)) == 0) { return last.slice(0, n); }
      }
    }
    return "";
  };

  this._handle_repl_toggle_group = function(event, target)
  {
    var li = target.parentNode;
    if (target.hasClass("open"))
    {
      target.removeClass("open");
      li.nextSibling.style.display = "none";
    }
    else
    {
      target.addClass("open");
      li.nextSibling.style.display = "";
    }
  };

  this._handle_option_change_bound = function(event, target)
  {
    settings.repl.set('max-typed-history-length', target.value);
    messages.post("setting-changed", {id: "repl", key: "max-typed-history-length"});
  }.bind(this);

  var eh = window.eventHandlers;
  eh.click["repl-toggle-group"] = this._handle_repl_toggle_group;
  eh.keypress['repl-textarea'] = this._handle_keypress_bound;
  eh.change['set-typed-history-length'] = this._handle_option_change_bound;

  this.init(id, name, container_class, html, default_handler);
};
cls.ReplView.prototype = ViewBase;



cls.ReplView.create_ui_widgets = function()
{

  new Settings(
    'repl',
    { // key/value
      'max-typed-history-length': 8,
      'typed-history': []
    },
    { // key/label
      'max-typed-history-length': "Max items in typed history to remember"
    },
    { // settings map
      customSettings:
      [
        'max-typed-history-length'
      ]
    },
    {  // custom templates
      'max-typed-history-length':
      function(setting)
      {
        return (
        [
          'setting-composite',
          ['label',
           setting.label_map['max-typed-history-length'] + ': ',
           ['input',
            'type', 'number',
            'handler', 'set-typed-history-length',
            'max', '1000',
            'min', '0',
            'value', setting.get('max-typed-history-length')
           ]
          ]
        ]);
      }
    }
  );
};
