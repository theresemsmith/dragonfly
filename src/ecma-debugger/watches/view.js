﻿window.cls || (window.cls = {});

/**
  * @constructor
  * @extends ViewBase
  */

cls.WatchesView = function(id, name, container_class)
{
  const
  MODE_DEFAULT = "default",
  MODE_EDIT = "edit";

  this._tmpl_main = function()
  {
    return (
    [
      ['div'],
      ['div',
        ['input',
          'type', 'button',
          'value', 'Add',
          'handler', 'watches-add'
        ],
        'class', 'watches-controls'
      ]
    ]);
  };

  this._tmpl_new_prop = function()
  {
    return ['item', ['key', 'class', 'no-expander', 'data-prop-uid','0']];
  };

  this.createView = function(container)
  {
    if (!this._watch_container)
    {
      container.clearAndRender(this._tmpl_main());
      this._watch_container = container.firstElementChild;
    }
    var tmpl = window.templates.inspected_js_object(this._data, false, null);
    this._watch_container.clearAndRender(tmpl);
  };

  this.ondestroy = function()
  {
    this._watch_container = null;
  };

  this.add_watch = function(uid, key)
  {
    if (key)
    {
      this._data.add_property(uid, key);
    }
    else
    {
      this._data.remove_property(uid);
    }
  };

  /* action handler interface */

  ActionHandlerInterface.apply(this);

  this.onclick = function(event)
  {
    if (this.mode == MODE_EDIT)
    {
      if (this._editor.onclick(event))
      {
        this.mode = MODE_DEFAULT;
        return true;
      }
      return false;
    }
    return true;
  };

  this._handlers['edit'] = function(event, target)
  {
    var ele = this._get_editable_item(event, target);
    if (ele)
    {
      this.mode = MODE_EDIT;
      this._editor.edit(event, ele);
    }
  }.bind(this);

  this._handlers['delete'] = function(event, target)
  {
    var ele = this._get_editable_item(event, target);
    if (ele)
    {
      this._data.remove_property(ele.getAttribute('data-prop-uid'));
    }
  }.bind(this);

  this._handlers['submit'] = function(event, target)
  {
    if (this.mode == MODE_EDIT)
    {
      this._editor.submit();
      return false;
    }
  }.bind(this);

  this._handlers['cancel'] = function(event, target)
  {
    if (this.mode == MODE_EDIT)
    {
      this._editor.cancel();
      return false;
    }
  }.bind(this);

  this._handlers['add'] = function(event, target)
  {
    if (this._watch_container)
    {
      var proto = this._watch_container.getElementsByClassName('prototype')[0];
      if (proto)
      {
        var key = proto.render(this._tmpl_new_prop()).firstElementChild;
        this.mode = MODE_EDIT;
        this._editor.edit(event, key);
      }
    }
  }.bind(this);

  this._onframeselected = function(msg)
  {
    if (msg.frame_index != -1 || this._last_selected_frame_index != -1)
    {
      this._data.update_watches();
    }
    this._last_selected_frame_index = msg.frame_index;
  };

  this._get_editable_item = function(event, target)
  {
    var ele = event.target;
    while (ele && ele.nodeName.toLowerCase() != 'item' &&
          (ele = ele.parentNode) && ele != target);
    ele = ele && ele.getElementsByTagName('key')[0];
    if (ele && ele.hasAttribute('data-prop-uid'))
    {
      return ele;
    }
    return null;
  };
  
  var watches_common_items = 
  [
    {
      label: "Add watch",
      handler: this._handlers['add'],
    }
  ];
                              
  var watches_editable_items = 
  [
    {
      label: "Edit",
      handler: this._handlers['edit'],
    },
    {
      label: "Delete",
      handler: this._handlers['delete'],
    }
  ]
  .concat(ContextMenu.separator)
  .concat(watches_common_items);

  var watches_menu =
  [
    {
      callback: function(event, target)
      {
        return (
        this._get_editable_item(event, target) ?
        watches_editable_items :
        watches_common_items);
      }.bind(this)
    }
  ];

  this._init = function(id, name, container_class)
  {
    this.init(id, name, container_class, null, null, 'watches-edit-prop');
    this._last_selected_frame_index = 0;
    this._watch_container = null;
    this._data = new cls.Watches(this);
    this._editor = new cls.JSPropertyEditor(this);
    eventHandlers.dblclick['watches-edit-prop'] = this._handlers['edit'];
    eventHandlers.click['watches-add'] = this._handlers['add'];
    ActionBroker.get_instance().register_handler(this);
    ContextMenu.get_instance().register("watches", watches_menu);
    messages.addListener('frame-selected', this._onframeselected.bind(this));
  };

  this._init(id, name, container_class);

};
