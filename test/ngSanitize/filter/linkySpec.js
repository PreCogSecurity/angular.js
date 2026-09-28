'use strict';

describe('linky', function() {
  var linky;

  beforeEach(module('ngSanitize'));

  beforeEach(inject(function($filter) {
    linky = $filter('linky');
  }));

  it('should do basic filter', function() {
    expect(linky("http://ab/ (http://a/) <http://a/> http://1.2/v:~-123. c “http://example.com” ‘http://me.com’")).
      toEqual('<a href="http://ab/">http://ab/</a> ' +
              '(<a href="http://a/">http://a/</a>) ' +
              '&lt;<a href="http://a/">http://a/</a>&gt; ' +
              '<a href="http://1.2/v:~-123">http://1.2/v:~-123</a>. c ' +
              '&#8220;<a href="http://example.com">http://example.com</a>&#8221; ' +
              '&#8216;<a href="http://me.com">http://me.com</a>&#8217;');
    expect(linky(undefined)).not.toBeDefined();
  });

  it('should return `undefined`/`null`/`""` values unchanged', function() {
    expect(linky(undefined)).toBeUndefined();
    expect(linky(null)).toBe(null);
    expect(linky('')).toBe('');
  });

  it('should throw an error when used with a non-string value (other than `undefined`/`null`)',
    function() {
      expect(function() { linky(false); }).
        toThrowMinErr('linky', 'notstring', 'Expected string but received: false');

      expect(function() { linky(true); }).
        toThrowMinErr('linky', 'notstring', 'Expected string but received: true');

      expect(function() { linky(0); }).
        toThrowMinErr('linky', 'notstring', 'Expected string but received: 0');

      expect(function() { linky(42); }).
        toThrowMinErr('linky', 'notstring', 'Expected string but received: 42');

      expect(function() { linky({}); }).
        toThrowMinErr('linky', 'notstring', 'Expected string but received: {}');

      expect(function() { linky([]); }).
        toThrowMinErr('linky', 'notstring', 'Expected string but received: []');

      expect(function() { linky(noop); }).
        toThrowMinErr('linky', 'notstring', 'Expected string but received: function noop()');
    }
  );

  it('should be case-insensitive', function() {
    expect(linky('WWW.example.com')).toEqual('<a href="http://WWW.example.com">WWW.example.com</a>');
    expect(linky('WWW.EXAMPLE.COM')).toEqual('<a href="http://WWW.EXAMPLE.COM">WWW.EXAMPLE.COM</a>');
    expect(linky('HTTP://www.example.com')).toEqual('<a href="HTTP://www.example.com">HTTP://www.example.com</a>');
    expect(linky('HTTP://example.com')).toEqual('<a href="HTTP://example.com">HTTP://example.com</a>');
    expect(linky('HTTPS://www.example.com')).toEqual('<a href="HTTPS://www.example.com">HTTPS://www.example.com</a>');
    expect(linky('HTTPS://example.com')).toEqual('<a href="HTTPS://example.com">HTTPS://example.com</a>');
  });

  it('should handle www.', function() {
    expect(linky('www.example.com')).toEqual('<a href="http://www.example.com">www.example.com</a>');
  });

  it('should handle mailto:', function() {
    expect(linky("mailto:me@example.com")).
                    toEqual('<a href="mailto:me@example.com">me@example.com</a>');
    expect(linky("me@example.com")).
                    toEqual('<a href="mailto:me@example.com">me@example.com</a>');
    expect(linky("send email to me@example.com, but")).
      toEqual('send email to <a href="mailto:me@example.com">me@example.com</a>, but');
    expect(linky("my email is \"me@example.com\"")).
      toEqual('my email is &#34;<a href="mailto:me@example.com">me@example.com</a>&#34;');
  });

  it('should handle quotes in the email', function() {
    expect(linky('foo@"bar".com')).toEqual('<a href="mailto:foo@&#34;bar&#34;.com">foo@&#34;bar&#34;.com</a>');
  });

  it('should handle target:', function() {
    expect(linky("http://example.com", "_blank")).
      toBeOneOf('<a target="_blank" href="http://example.com">http://example.com</a>',
                '<a href="http://example.com" target="_blank">http://example.com</a>');
    expect(linky("http://example.com", "someNamedIFrame")).
      toBeOneOf('<a target="someNamedIFrame" href="http://example.com">http://example.com</a>',
                '<a href="http://example.com" target="someNamedIFrame">http://example.com</a>');
  });

  describe('custom attributes', function() {

    it('should optionally add custom attributes', function() {
      expect(linky("http://example.com", "_self", {rel: "nofollow"})).
        toBeOneOf('<a rel="nofollow" target="_self" href="http://example.com">http://example.com</a>',
                  '<a href="http://example.com" target="_self" rel="nofollow">http://example.com</a>');
    });


    it('should override target parameter with custom attributes', function() {
      expect(linky("http://example.com", "_self", {target: "_blank"})).
        toBeOneOf('<a target="_blank" href="http://example.com">http://example.com</a>',
                  '<a href="http://example.com" target="_blank">http://example.com</a>');
    });


    it('should optionally add custom attributes from function', function() {
      expect(linky("http://example.com", "_self", function(url) {return {"class": "blue"};})).
        toBeOneOf('<a class="blue" target="_self" href="http://example.com">http://example.com</a>',
                  '<a href="http://example.com" target="_self" class="blue">http://example.com</a>',
                  '<a class="blue" href="http://example.com" target="_self">http://example.com</a>');
    });


    it('should pass url as parameter to custom attribute function', function() {
      var linkParameters = jasmine.createSpy('linkParameters').and.returnValue({"class": "blue"});
      linky("http://example.com", "_self", linkParameters);
      expect(linkParameters).toHaveBeenCalledWith('http://example.com');
    });


    it('should strip unsafe attributes', function() {
      expect(linky("http://example.com", "_self", {"class": "blue", "onclick": "alert('Hi')"})).
        toBeOneOf('<a class="blue" target="_self" href="http://example.com">http://example.com</a>',
                  '<a href="http://example.com" target="_self" class="blue">http://example.com</a>',
                  '<a class="blue" href="http://example.com" target="_self">http://example.com</a>');
    });


    it('should apply a custom attribute function to every link', function() {
      // The resolved attribute map must not replace the function itself,
      // otherwise every link after the first one loses its custom attributes.
      expect(linky("http://a.com and http://b.com", null, function(url) {
        return {"class": url === 'http://a.com' ? 'first' : 'second'};
      })).
        toBe('<a class="first" href="http://a.com">http://a.com</a> and ' +
            '<a class="second" href="http://b.com">http://b.com</a>');
    });


    it('should call a custom attribute function once per link', function() {
      var linkParameters = jasmine.createSpy('linkParameters').and.returnValue({});
      linky("http://a.com and http://b.com", null, linkParameters);
      expect(linkParameters.callCount).toBe(2);
      expect(linkParameters).toHaveBeenCalledWith('http://a.com');
      expect(linkParameters).toHaveBeenCalledWith('http://b.com');
    });


    it('should not serialize inherited attribute properties', function() {
      // Guards against prototype pollution: a property planted on the
      // prototype must never end up in the generated markup, even when the
      // sanitizer would happily keep it.
      var attributes = Object.create({class: 'polluted'});
      attributes.rel = 'nofollow';

      expect(linky('http://example.com', null, attributes)).toBeOneOf(
        '<a rel="nofollow" href="http://example.com">http://example.com</a>',
        '<a href="http://example.com" rel="nofollow">http://example.com</a>');
    });


    it('should not allow an attribute value to break out of the attribute', function() {
      // The name and the value are entity-encoded before being spliced into
      // the markup, so the `"` cannot terminate the `class` attribute and turn
      // `onmouseover` into a real event handler attribute. The whole thing
      // stays inside the quoted value of `class`.
      expect(linky('http://example.com', '_blank', {
        'class': 'x" onmouseover="alert(1)'
      })).toBeOneOf(
        '<a class="x&#34; onmouseover=&#34;alert(1)" target="_blank" ' +
        'href="http://example.com">http://example.com</a>',
        '<a target="_blank" class="x&#34; onmouseover=&#34;alert(1)" ' +
        'href="http://example.com">http://example.com</a>',
        '<a class="x&#34; onmouseover=&#34;alert(1)" href="http://example.com" ' +
        'target="_blank">http://example.com</a>');
    });


    it('should not allow the target to break out of the attribute', function() {
      expect(linky('http://example.com', '_blank" onload="alert(1)')).toBeOneOf(
        '<a target="_blank&#34; onload=&#34;alert(1)" ' +
        'href="http://example.com">http://example.com</a>',
        '<a href="http://example.com" target="_blank&#34; onload=&#34;alert(1)">' +
        'http://example.com</a>');
    });
  });
});
