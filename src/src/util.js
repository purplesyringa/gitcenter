function sanitizeStringForUrl(s) {
	var url = s.toLowerCase();
	// Get rid of spaces
	url = url.replace(/ /g, '-');
	// Get rid of any punctuation
	url = url.replace(/(\?|\.|,|!|#|\*)/g, '').replace(/&/, '-');
	// Get rid of other symbols
	url = url.replace(/(\^|\(|\)|\+|=|\/|\\|\{|\}|\[|\]|:|;|'|"|`|~)/g, '');

	return url;
}

// SQL version
function sanitizeStringForUrl_SQL(column) {
	return "REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(" + column + ", \"'\", ''), '~', ''), '`', ''), '\"', ''), '\\;', ''), ':', ''), ']', ''), '[', ''), '}', ''), '{', ''), '\', ''), '/', ''), '=', ''), '+', ''), ')', ''), '(', ''), '^', ''), '&', '-'), '*', ''), '#', ''), '!', ''), ',', ''), '.', ''), '?', ''), ' ', '-')"
}

// Got this from this stack overflow answer: https://stackoverflow.com/questions/6003271/substring-text-with-html-tags-in-javascript/6003713#6003713
// By user113716
function html_substr( str, count ) {

    var div = document.createElement('div');
    div.innerHTML = str;

    walk( div, track );

    function track( el ) {
        if( count > 0 ) {
            var len = el.data.length;
            count -= len;
            if( count <= 0 ) {
                el.data = el.substringData( 0, el.data.length + count );
            }
        } else {
            el.data = '';
            //el.parentNode.removeChild(el); // Experimental
            el.outerHTML = "";
            delete el;
        }
    }

    function walk( el, fn ) {
        var node = el.firstChild;
        do {
            if( node.nodeType === 3 ) {
                fn(node);
            } else if( node.nodeType === 1 && node.childNodes && node.childNodes[0] ) {
                walk( node, fn );
            }
        } while( node = node.nextSibling );
    }
    return div.innerHTML;
}

function SQLReplace(inner, from, to = '', end = ', ') {
    return "REPLACE(" + inner + ", '" + from + "', '" + to + "')" + end;
}

function SQLReplace_multi(innermost, arrayObjects) {
    var string = innermost;
    for (var i = 0; i < arrayObjects.length; i++) {
        let object = arrayObjects[i];
        if (i == arrayObjects.length - 1) {
            string = SQLReplace(string, object.from, object.to, '');
            break;
        }
        string = SQLReplace(string, object.from, object.to, '');
    }

    return string;
}

function stripHTML_SQL(column) {
    string = SQLReplace_multi(column, [
            { from: '<p>', to: '' },
            { from: '</p>', to: ' ' },
            { from: '<br>', to: ' ' },
            { from: '<br/>', to: ' ' },
            { from: '<br />', to: ' ' },
            { from: '<hr>', to: ' ' },
            { from: '<hr/>', to: ' ' },
            { from: '<hr />', to: ' ' },
            { from: '<div align="center">', to: '' },
            { from: '<div align="right">', to: '' },
            { from: '<div>', to: '' },
            { from: '</div>', to: ' ' },
            { from: '<ul>', to: '' },
            { from: '</ul>', to: ' ' },
            { from: '<ol>', to: '' },
            { from: '</ol>', to: ' ' },
            { from: '<li>', to: '' },
            { from: '</li>', to: ' ' },
            { from: '<i>', to: '' },
            { from: '</i>', to: '' },
            { from: '<em>', to: '' },
            { from: '</em>', to: '' },
            { from: '<b>', to: '' },
            { from: '</b>', to: '' },
            { from: '<strong>', to: '' },
            { from: '</strong>', to: '' },
            { from: '<strike>', to: '' },
            { from: '</strike>', to: '' },
            { from: '<u>', to: '' },
            { from: '</u>', to: '' }
        ]);
    console.log(string);
    return string;
    //return SQLReplace("REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(" + column + ", '<b>', ''), '<i>', ''), '<em>', ''), '<p>', ''), '<div>', ''), '<u>', ''), '<br>', ''), '<br />', ''), '<span>', ''), '<hr>', ''), '<nl>', ''), '<strike>', '')", '</p>');
}

var sanitizeHtml = require("sanitize-html");

function sanitizeHtmlForDb(text) {
    return sanitizeHtml(text, {
        allowedTags: ["b", "i", "em", "strong", "u", "a", "h1", "h2", "h3", "h4", "h5", "h6", "p", "br", "div", "blockquote", "code", "strike", "ul", "li", "ol", "nl", "hr", "table", "thead", "caption", "tbody", "tr", "th", "td", "pre", "span", "img", "audio", "video"],
        allowedAttributes: {
            "a": [ "href", "name", "target", "align" ],
            "img": [ "src", "align", "width", "height"],
            "audio": [ "src", "align", "width", "height", "controls"],
            "video": [ "src", "align", "width", "height", "controls"],
            "div": [ "align" ],
            "p": [ "align" ],
            "h1": [ "align" ],
            "h2": [ "align" ],
            "h3": [ "align" ],
            "h4": [ "align" ],
            "h5": [ "align" ],
            "h6": [ "align" ],
            "strong": [ "align" ],
            "u": [ "align" ],
            "b": [ "align" ],
            "i": [ "align" ],
            "em": [ "align" ],
            "pre": [ "align" ],
            "code": [ "align" ],
            "table": [ "align" ]
        },
        allowedSchemesByTag: {
          img: [ "data" ],
          audio: [ "data" ],
          video: [ "data" ]
        }
    });
}

module.exports = {
	sanitizeStringForUrl: sanitizeStringForUrl,
	sanitizeStringForUrl_SQL: sanitizeStringForUrl_SQL,
	html_substr: html_substr,
    stripHTML_SQL: stripHTML_SQL,
    sanitizeHtmlForDb: sanitizeHtmlForDb
}