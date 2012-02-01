var URI = function(uri)
{
  this._init(uri);
};

URIPrototype = function(uri_prop_name)
{
  /*
    interface
    
    hash
    host
    hostname
    href
    pathname
    port
    protocol
    search
    filename
    dir_pathname  pathname minus filename
    abs_dir protocol plus hostname plus dir_pathname

  */

  [
    "hash",
    "host",
    "hostname",
    "href",
    "pathname",
    "port",
    "protocol",
    "search"
  ].forEach(function(prop)
  {
    this.__defineGetter__(prop, function()
    {
      if (!this._a)
        this._init();

      return this._a[prop];  
    });

    this.__defineSetter__(prop, function() {});
    
  }, this);

  this.__defineGetter__("filename", function()
  {
        
    if (!this._filename)
      this._filename = this.pathname.slice(this.pathname.lastIndexOf("/") + 1);

    return this._filename;  
  });

  this.__defineGetter__("dir_pathname", function()
  {
    if (!this._dir_pathname)
      this._dir_pathname = this.pathname.slice(0, this.pathname.lastIndexOf("/") + 1);

    return this._dir_pathname;  
  });

  this.__defineSetter__("abs_dir", function() {});

  this.__defineGetter__("abs_dir", function()
  {
    if (!this._abs_dir)
      this._abs_dir = this.protocol + "//" + this.host + this.dir_pathname;

    return this._abs_dir;  
  });

  this.__defineSetter__("abs_dir", function() {});

  this._init = function(uri)
  {
    if (!uri && this[uri_prop_name])
      uri = this[uri_prop_name];

    if (uri)
    {
      this._a = document.createElement("a");
      this._a.href = uri;
    }
  };

};

URI.prototype = new URIPrototype();