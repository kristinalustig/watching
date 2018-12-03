// Created with Squiffy 5.1.2
// https://github.com/textadventures/squiffy

(function(){
/* jshint quotmark: single */
/* jshint evil: true */

var squiffy = {};

(function () {
    'use strict';

    squiffy.story = {};

    var initLinkHandler = function () {
        var handleLink = function (link) {
            if (link.hasClass('disabled')) return;
            var passage = link.data('passage');
            var section = link.data('section');
            var rotateAttr = link.attr('data-rotate');
            var sequenceAttr = link.attr('data-sequence');
            if (passage) {
                disableLink(link);
                squiffy.set('_turncount', squiffy.get('_turncount') + 1);
                passage = processLink(passage);
                if (passage) {
                    currentSection.append('<hr/>');
                    squiffy.story.passage(passage);
                }
                var turnPassage = '@' + squiffy.get('_turncount');
                if (turnPassage in squiffy.story.section.passages) {
                    squiffy.story.passage(turnPassage);
                }
                if ('@last' in squiffy.story.section.passages && squiffy.get('_turncount')>= squiffy.story.section.passageCount) {
                    squiffy.story.passage('@last');
                }
            }
            else if (section) {
                currentSection.append('<hr/>');
                disableLink(link);
                section = processLink(section);
                squiffy.story.go(section);
            }
            else if (rotateAttr || sequenceAttr) {
                var result = rotate(rotateAttr || sequenceAttr, rotateAttr ? link.text() : '');
                link.html(result[0].replace(/&quot;/g, '"').replace(/&#39;/g, '\''));
                var dataAttribute = rotateAttr ? 'data-rotate' : 'data-sequence';
                link.attr(dataAttribute, result[1]);
                if (!result[1]) {
                    disableLink(link);
                }
                if (link.attr('data-attribute')) {
                    squiffy.set(link.attr('data-attribute'), result[0]);
                }
                squiffy.story.save();
            }
        };

        squiffy.ui.output.on('click', 'a.squiffy-link', function () {
            handleLink(jQuery(this));
        });

        squiffy.ui.output.on('keypress', 'a.squiffy-link', function (e) {
            if (e.which !== 13) return;
            handleLink(jQuery(this));
        });

        squiffy.ui.output.on('mousedown', 'a.squiffy-link', function (event) {
            event.preventDefault();
        });
    };

    var disableLink = function (link) {
        link.addClass('disabled');
        link.attr('tabindex', -1);
    }
    
    squiffy.story.begin = function () {
        if (!squiffy.story.load()) {
            squiffy.story.go(squiffy.story.start);
        }
    };

    var processLink = function(link) {
		link = String(link);
        var sections = link.split(',');
        var first = true;
        var target = null;
        sections.forEach(function (section) {
            section = section.trim();
            if (startsWith(section, '@replace ')) {
                replaceLabel(section.substring(9));
            }
            else {
                if (first) {
                    target = section;
                }
                else {
                    setAttribute(section);
                }
            }
            first = false;
        });
        return target;
    };

    var setAttribute = function(expr) {
        var lhs, rhs, op, value;
        var setRegex = /^([\w]*)\s*=\s*(.*)$/;
        var setMatch = setRegex.exec(expr);
        if (setMatch) {
            lhs = setMatch[1];
            rhs = setMatch[2];
            if (isNaN(rhs)) {
				if(startsWith(rhs,"@")) rhs=squiffy.get(rhs.substring(1));
                squiffy.set(lhs, rhs);
            }
            else {
                squiffy.set(lhs, parseFloat(rhs));
            }
        }
        else {
			var incDecRegex = /^([\w]*)\s*([\+\-\*\/])=\s*(.*)$/;
            var incDecMatch = incDecRegex.exec(expr);
            if (incDecMatch) {
                lhs = incDecMatch[1];
                op = incDecMatch[2];
				rhs = incDecMatch[3];
				if(startsWith(rhs,"@")) rhs=squiffy.get(rhs.substring(1));
				rhs = parseFloat(rhs);
                value = squiffy.get(lhs);
                if (value === null) value = 0;
                if (op == '+') {
                    value += rhs;
                }
                if (op == '-') {
                    value -= rhs;
                }
				if (op == '*') {
					value *= rhs;
				}
				if (op == '/') {
					value /= rhs;
				}
                squiffy.set(lhs, value);
            }
            else {
                value = true;
                if (startsWith(expr, 'not ')) {
                    expr = expr.substring(4);
                    value = false;
                }
                squiffy.set(expr, value);
            }
        }
    };

    var replaceLabel = function(expr) {
        var regex = /^([\w]*)\s*=\s*(.*)$/;
        var match = regex.exec(expr);
        if (!match) return;
        var label = match[1];
        var text = match[2];
        if (text in squiffy.story.section.passages) {
            text = squiffy.story.section.passages[text].text;
        }
        else if (text in squiffy.story.sections) {
            text = squiffy.story.sections[text].text;
        }
        var stripParags = /^<p>(.*)<\/p>$/;
        var stripParagsMatch = stripParags.exec(text);
        if (stripParagsMatch) {
            text = stripParagsMatch[1];
        }
        var $labels = squiffy.ui.output.find('.squiffy-label-' + label);
        $labels.fadeOut(1000, function() {
            $labels.html(squiffy.ui.processText(text));
            $labels.fadeIn(1000, function() {
                squiffy.story.save();
            });
        });
    };

    squiffy.story.go = function(section) {
        squiffy.set('_transition', null);
        newSection();
        squiffy.story.section = squiffy.story.sections[section];
        if (!squiffy.story.section) return;
        squiffy.set('_section', section);
        setSeen(section);
        var master = squiffy.story.sections[''];
        if (master) {
            squiffy.story.run(master);
            squiffy.ui.write(master.text);
        }
        squiffy.story.run(squiffy.story.section);
        // The JS might have changed which section we're in
        if (squiffy.get('_section') == section) {
            squiffy.set('_turncount', 0);
            squiffy.ui.write(squiffy.story.section.text);
            squiffy.story.save();
        }
    };

    squiffy.story.run = function(section) {
        if (section.clear) {
            squiffy.ui.clearScreen();
        }
        if (section.attributes) {
            processAttributes(section.attributes);
        }
        if (section.js) {
            section.js();
        }
    };

    squiffy.story.passage = function(passageName) {
        var passage = squiffy.story.section.passages[passageName];
        if (!passage) return;
        setSeen(passageName);
        var masterSection = squiffy.story.sections[''];
        if (masterSection) {
            var masterPassage = masterSection.passages[''];
            if (masterPassage) {
                squiffy.story.run(masterPassage);
                squiffy.ui.write(masterPassage.text);
            }
        }
        var master = squiffy.story.section.passages[''];
        if (master) {
            squiffy.story.run(master);
            squiffy.ui.write(master.text);
        }
        squiffy.story.run(passage);
        squiffy.ui.write(passage.text);
        squiffy.story.save();
    };

    var processAttributes = function(attributes) {
        attributes.forEach(function (attribute) {
            if (startsWith(attribute, '@replace ')) {
                replaceLabel(attribute.substring(9));
            }
            else {
                setAttribute(attribute);
            }
        });
    };

    squiffy.story.restart = function() {
        if (squiffy.ui.settings.persist && window.localStorage) {
            var keys = Object.keys(localStorage);
            jQuery.each(keys, function (idx, key) {
                if (startsWith(key, squiffy.story.id)) {
                    localStorage.removeItem(key);
                }
            });
        }
        else {
            squiffy.storageFallback = {};
        }
        if (squiffy.ui.settings.scroll === 'element') {
            squiffy.ui.output.html('');
            squiffy.story.begin();
        }
        else {
            location.reload();
        }
    };

    squiffy.story.save = function() {
        squiffy.set('_output', squiffy.ui.output.html());
    };

    squiffy.story.load = function() {
        var output = squiffy.get('_output');
        if (!output) return false;
        squiffy.ui.output.html(output);
        currentSection = jQuery('#' + squiffy.get('_output-section'));
        squiffy.story.section = squiffy.story.sections[squiffy.get('_section')];
        var transition = squiffy.get('_transition');
        if (transition) {
            eval('(' + transition + ')()');
        }
        return true;
    };

    var setSeen = function(sectionName) {
        var seenSections = squiffy.get('_seen_sections');
        if (!seenSections) seenSections = [];
        if (seenSections.indexOf(sectionName) == -1) {
            seenSections.push(sectionName);
            squiffy.set('_seen_sections', seenSections);
        }
    };

    squiffy.story.seen = function(sectionName) {
        var seenSections = squiffy.get('_seen_sections');
        if (!seenSections) return false;
        return (seenSections.indexOf(sectionName) > -1);
    };
    
    squiffy.ui = {};

    var currentSection = null;
    var screenIsClear = true;
    var scrollPosition = 0;

    var newSection = function() {
        if (currentSection) {
            disableLink(jQuery('.squiffy-link', currentSection));
        }
        var sectionCount = squiffy.get('_section-count') + 1;
        squiffy.set('_section-count', sectionCount);
        var id = 'squiffy-section-' + sectionCount;
        currentSection = jQuery('<div/>', {
            id: id,
        }).appendTo(squiffy.ui.output);
        squiffy.set('_output-section', id);
    };

    squiffy.ui.write = function(text) {
        screenIsClear = false;
        scrollPosition = squiffy.ui.output.height();
        currentSection.append(jQuery('<div/>').html(squiffy.ui.processText(text)));
        squiffy.ui.scrollToEnd();
    };

    squiffy.ui.clearScreen = function() {
        squiffy.ui.output.html('');
        screenIsClear = true;
        newSection();
    };

    squiffy.ui.scrollToEnd = function() {
        var scrollTo, currentScrollTop, distance, duration;
        if (squiffy.ui.settings.scroll === 'element') {
            scrollTo = squiffy.ui.output[0].scrollHeight - squiffy.ui.output.height();
            currentScrollTop = squiffy.ui.output.scrollTop();
            if (scrollTo > currentScrollTop) {
                distance = scrollTo - currentScrollTop;
                duration = distance / 0.4;
                squiffy.ui.output.stop().animate({ scrollTop: scrollTo }, duration);
            }
        }
        else {
            scrollTo = scrollPosition;
            currentScrollTop = Math.max(jQuery('body').scrollTop(), jQuery('html').scrollTop());
            if (scrollTo > currentScrollTop) {
                var maxScrollTop = jQuery(document).height() - jQuery(window).height();
                if (scrollTo > maxScrollTop) scrollTo = maxScrollTop;
                distance = scrollTo - currentScrollTop;
                duration = distance / 0.5;
                jQuery('body,html').stop().animate({ scrollTop: scrollTo }, duration);
            }
        }
    };

    squiffy.ui.processText = function(text) {
        function process(text, data) {
            var containsUnprocessedSection = false;
            var open = text.indexOf('{');
            var close;
            
            if (open > -1) {
                var nestCount = 1;
                var searchStart = open + 1;
                var finished = false;
             
                while (!finished) {
                    var nextOpen = text.indexOf('{', searchStart);
                    var nextClose = text.indexOf('}', searchStart);
         
                    if (nextClose > -1) {
                        if (nextOpen > -1 && nextOpen < nextClose) {
                            nestCount++;
                            searchStart = nextOpen + 1;
                        }
                        else {
                            nestCount--;
                            searchStart = nextClose + 1;
                            if (nestCount === 0) {
                                close = nextClose;
                                containsUnprocessedSection = true;
                                finished = true;
                            }
                        }
                    }
                    else {
                        finished = true;
                    }
                }
            }
            
            if (containsUnprocessedSection) {
                var section = text.substring(open + 1, close);
                var value = processTextCommand(section, data);
                text = text.substring(0, open) + value + process(text.substring(close + 1), data);
            }
            
            return (text);
        }

        function processTextCommand(text, data) {
            if (startsWith(text, 'if ')) {
                return processTextCommand_If(text, data);
            }
            else if (startsWith(text, 'else:')) {
                return processTextCommand_Else(text, data);
            }
            else if (startsWith(text, 'label:')) {
                return processTextCommand_Label(text, data);
            }
            else if (/^rotate[: ]/.test(text)) {
                return processTextCommand_Rotate('rotate', text, data);
            }
            else if (/^sequence[: ]/.test(text)) {
                return processTextCommand_Rotate('sequence', text, data);   
            }
            else if (text in squiffy.story.section.passages) {
                return process(squiffy.story.section.passages[text].text, data);
            }
            else if (text in squiffy.story.sections) {
                return process(squiffy.story.sections[text].text, data);
            }
			else if (startsWith(text,'@') && !startsWith(text,'@replace')) {
				processAttributes(text.substring(1).split(","));
				return "";
			}
            return squiffy.get(text);
        }

        function processTextCommand_If(section, data) {
            var command = section.substring(3);
            var colon = command.indexOf(':');
            if (colon == -1) {
                return ('{if ' + command + '}');
            }

            var text = command.substring(colon + 1);
            var condition = command.substring(0, colon);
			condition = condition.replace("<", "&lt;");
            var operatorRegex = /([\w ]*)(=|&lt;=|&gt;=|&lt;&gt;|&lt;|&gt;)(.*)/;
            var match = operatorRegex.exec(condition);

            var result = false;

            if (match) {
                var lhs = squiffy.get(match[1]);
                var op = match[2];
                var rhs = match[3];

				if(startsWith(rhs,'@')) rhs=squiffy.get(rhs.substring(1));
				
                if (op == '=' && lhs == rhs) result = true;
                if (op == '&lt;&gt;' && lhs != rhs) result = true;
                if (op == '&gt;' && lhs > rhs) result = true;
                if (op == '&lt;' && lhs < rhs) result = true;
                if (op == '&gt;=' && lhs >= rhs) result = true;
                if (op == '&lt;=' && lhs <= rhs) result = true;
            }
            else {
                var checkValue = true;
                if (startsWith(condition, 'not ')) {
                    condition = condition.substring(4);
                    checkValue = false;
                }

                if (startsWith(condition, 'seen ')) {
                    result = (squiffy.story.seen(condition.substring(5)) == checkValue);
                }
                else {
                    var value = squiffy.get(condition);
                    if (value === null) value = false;
                    result = (value == checkValue);
                }
            }

            var textResult = result ? process(text, data) : '';

            data.lastIf = result;
            return textResult;
        }

        function processTextCommand_Else(section, data) {
            if (!('lastIf' in data) || data.lastIf) return '';
            var text = section.substring(5);
            return process(text, data);
        }

        function processTextCommand_Label(section, data) {
            var command = section.substring(6);
            var eq = command.indexOf('=');
            if (eq == -1) {
                return ('{label:' + command + '}');
            }

            var text = command.substring(eq + 1);
            var label = command.substring(0, eq);

            return '<span class="squiffy-label-' + label + '">' + process(text, data) + '</span>';
        }

        function processTextCommand_Rotate(type, section, data) {
            var options;
            var attribute = '';
            if (section.substring(type.length, type.length + 1) == ' ') {
                var colon = section.indexOf(':');
                if (colon == -1) {
                    return '{' + section + '}';
                }
                options = section.substring(colon + 1);
                attribute = section.substring(type.length + 1, colon);
            }
            else {
                options = section.substring(type.length + 1);
            }
            var rotation = rotate(options.replace(/"/g, '&quot;').replace(/'/g, '&#39;'));
            if (attribute) {
                squiffy.set(attribute, rotation[0]);
            }
            return '<a class="squiffy-link" data-' + type + '="' + rotation[1] + '" data-attribute="' + attribute + '" role="link">' + rotation[0] + '</a>';
        }

        var data = {
            fulltext: text
        };
        return process(text, data);
    };

    squiffy.ui.transition = function(f) {
        squiffy.set('_transition', f.toString());
        f();
    };

    squiffy.storageFallback = {};

    squiffy.set = function(attribute, value) {
        if (typeof value === 'undefined') value = true;
        if (squiffy.ui.settings.persist && window.localStorage) {
            localStorage[squiffy.story.id + '-' + attribute] = JSON.stringify(value);
        }
        else {
            squiffy.storageFallback[attribute] = JSON.stringify(value);
        }
        squiffy.ui.settings.onSet(attribute, value);
    };

    squiffy.get = function(attribute) {
        var result;
        if (squiffy.ui.settings.persist && window.localStorage) {
            result = localStorage[squiffy.story.id + '-' + attribute];
        }
        else {
            result = squiffy.storageFallback[attribute];
        }
        if (!result) return null;
        return JSON.parse(result);
    };

    var startsWith = function(string, prefix) {
        return string.substring(0, prefix.length) === prefix;
    };

    var rotate = function(options, current) {
        var colon = options.indexOf(':');
        if (colon == -1) {
            return [options, current];
        }
        var next = options.substring(0, colon);
        var remaining = options.substring(colon + 1);
        if (current) remaining += ':' + current;
        return [next, remaining];
    };

    var methods = {
        init: function (options) {
            var settings = jQuery.extend({
                scroll: 'body',
                persist: true,
                restartPrompt: true,
                onSet: function (attribute, value) {}
            }, options);

            squiffy.ui.output = this;
            squiffy.ui.restart = jQuery(settings.restart);
            squiffy.ui.settings = settings;

            if (settings.scroll === 'element') {
                squiffy.ui.output.css('overflow-y', 'auto');
            }

            initLinkHandler();
            squiffy.story.begin();
            
            return this;
        },
        get: function (attribute) {
            return squiffy.get(attribute);
        },
        set: function (attribute, value) {
            squiffy.set(attribute, value);
        },
        restart: function () {
            if (!squiffy.ui.settings.restartPrompt || confirm('Are you sure you want to restart?')) {
                squiffy.story.restart();
            }
        }
    };

    jQuery.fn.squiffy = function (methodOrOptions) {
        if (methods[methodOrOptions]) {
            return methods[methodOrOptions]
                .apply(this, Array.prototype.slice.call(arguments, 1));
        }
        else if (typeof methodOrOptions === 'object' || ! methodOrOptions) {
            return methods.init.apply(this, arguments);
        } else {
            jQuery.error('Method ' +  methodOrOptions + ' does not exist');
        }
    };
})();

var get = squiffy.get;
var set = squiffy.set;


squiffy.story.start = 'Beginning';
squiffy.story.id = 'e424eb7b6b';
squiffy.story.sections = {
	'Beginning': {
		'text': "<p><img src=\"images/coverIntro.png\" id=\"introImage\" /></p>\n<div id=\"introText\">Turn on sound, and <a class=\"squiffy-link link-section\" data-section=\"begin.\" role=\"link\" tabindex=\"0\">begin.</a></div>",
		'js': function() {
			static = new Audio();
			document.body.className="introClass";
		},
		'passages': {
		},
	},
	'begin.': {
		'clear': true,
		'text': "<p><img src=\"images/snow.png\" class=\"floatingsnow\" style=\"width:10%; animation-delay: 1s;\"/>\n<img src=\"images/snow.png\" class=\"floatingsnow\" style=\"width:10%; animation-delay: 4s;\"/>\n<img src=\"images/snow.png\" class=\"floatingsnow\" style=\"width:15%; animation-delay: 8s;\"/>\n<img src=\"images/snow.png\" class=\"floatingsnow\" style=\"width:12%; animation-delay: 10s;\"/></p>\n<p>It&#39;s a snowy November evening. You were watching TV after dinner (as per usual) and you fell asleep on the couch. </p>\n<p>Again.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"leaveLR\" role=\"link\" tabindex=\"0\">DEV cut to end of intro</a></p>\n<p>{sequence:Zzz.:When&#39;s the last time you even made your bed?:You don&#39;t even have a pillow!:I&#39;m not very impressed with you right now.:Hello? Is anybody in there?:<a class=\"squiffy-link link-section\" data-section=\"waking up\" role=\"link\" tabindex=\"0\">Doesn&#39;t your back hurt?</a>}</p>",
		'passages': {
		},
	},
	'waking up': {
		'text': "<p>Right, well, your back is killing you when you wake up. You open your eyes again and when you glance at the clock, you see that it&#39;s around 3AM. </p>\n<p>The glow of the TV has painted the room in blues and greys. It&#39;s like it has sucked all of the warmth out of the world.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"Get off the couch\" role=\"link\" tabindex=\"0\">Get off the couch</a>\n <br /><br />\n<a class=\"squiffy-link link-section\" data-section=\"Shut your eyes again\" role=\"link\" tabindex=\"0\">Shut your eyes again</a></p>",
		'js': function() {
			document.body.className = 'dim';
			creepy = new Audio();
			creepy.src = "creepy.mp3";
			creepy.load();
			creepy.play();
		},
		'passages': {
		},
	},
	'Get off the couch': {
		'text': "<p>You slowly stand up, groaning as the kinks in your back creak their way out.</p>\n<p>You start to walk towards the kitchen to get some water. </p>\n<p><div class=\"narrator\">(of course, you didn&#39;t say you wanted to get some water, but you&#39;re probably thirsty)</div>\n<br />\n<a class=\"squiffy-link link-section\" data-section=\"I could use some water.\" role=\"link\" tabindex=\"0\">I could use some water.</a></p>",
		'passages': {
		},
	},
	'I could use some water.': {
		'text': "<p>But <a class=\"squiffy-link link-section\" data-section=\"TVintro\" role=\"link\" tabindex=\"0\">before</a> you get too far...</p>",
		'passages': {
		},
	},
	'Shut your eyes again': {
		'text': "<p>You can&#39;t really be bothered with things like &quot;getting up&quot; and &quot;leaving the couch,&quot; huh? You start to shut your eyes again.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"Zzz.\" role=\"link\" tabindex=\"0\">Zzz.</a></p>",
		'passages': {
		},
	},
	'Zzz.': {
		'text': "<p>Wow, seriously?</p>\n<p>Okay, fine, you settle back in on your lumpy couch for some more <em>truly restful</em> sleep.\n<br /></p>\n<p><div class=\"narrator\">(hey, fourth-wall-breaking narrative voices get to be sarcastic if we want to be)</div>\n<br /></p>\n<p><a class=\"squiffy-link link-section\" data-section=\"TVintro\" role=\"link\" tabindex=\"0\">And then you hear something.</a></p>",
		'passages': {
		},
	},
	'TVintro': {
		'clear': true,
		'text': "<p>The TV buzzes loudly, and you look to see that static has filled the screen. </p>\n<p>Through the static, a voice wavers...</p>\n<div class=\"badguy\">Hi there, you.</div>\n\n<p><br /></p>\n<p><a class=\"squiffy-link link-section\" data-section=\"wtf\" role=\"link\" tabindex=\"0\">&quot;What the hell?&quot;</a>\n<br /><br />\n<a class=\"squiffy-link link-section\" data-section=\"hello\" role=\"link\" tabindex=\"0\">&quot;Why, hello there.&quot;</a></p>",
		'js': function() {
			creepy.pause();
			static = new Audio();
			staticExists = 1;
			static.src = "static.wav";
			static.load();
			static.play();
			static.loop = true;
		},
		'passages': {
		},
	},
	'wtf': {
		'text': "<div class=\"badguy\">Oh yes, that&#39;s true.</div>\n\n<p><a class=\"squiffy-link link-section\" data-section=\"...\" role=\"link\" tabindex=\"0\">...</a></p>",
		'passages': {
		},
	},
	'hello': {
		'text': "<div class=\"badguy\">Playing it cool as a cucumber, huh?</div>\n\n<p><a class=\"squiffy-link link-section\" data-section=\"...\" role=\"link\" tabindex=\"0\">...</a></p>",
		'passages': {
		},
	},
	'...': {
		'text': "<div class=\"badguy\">Yes, fair enough. I have much to say to you.</div>\n\n<p>The static wavers for a moment, and through the static you can just make out a human-like shape blending into the darkest greys and blacks.</p>\n<p>You start to find this wavery voice pretty annoying, frankly.</p>\n<p>...and also, mildly terrifying?</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"leaveLR\" role=\"link\" tabindex=\"0\">You&#39;re right, I do. I&#39;m going to leave.</a></p>",
		'passages': {
		},
	},
	'leaveLR': {
		'text': "<div id=\"narrator\">Yeahhh, that&#39;s not going to work, though.</div>\n\n<p>When you try to leave, you make it a couple of steps towards the <a class=\"squiffy-link link-section\" data-section=\"titlescreen\" role=\"link\" tabindex=\"0\">door...</a></p>",
		'passages': {
		},
	},
	'titlescreen': {
		'clear': true,
		'text': "<div style=\"font-size:.7em; opacity:0; font-style:italic; color: white; text-align:center; margin-top:-20px; animation-name:disappear; animation-duration:40s;\">A text &quot;adventure&quot; by @kristinalustig for Ludum Dare 43.</div>\n<br />\n\n<div id=\"blammonext\"><a class=\"squiffy-link link-section\" data-section=\"Actually Begin\" role=\"link\" tabindex=\"0\">Actually Begin</a></div>",
		'js': function() {
			static.pause();
			document.getElementById("pageheader").className="blammo";
			document.body.className="blammobody";
		},
		'passages': {
		},
	},
	'Actually Begin': {
		'text': "<p>You wake up nice and snuggly in your bed. When you stand up, you feel well-rested, too!</p>\n<p><a class=\"squiffy-link link-passage\" data-passage=\"thatsgreat\" role=\"link\" tabindex=\"0\">That&#39;s... great?</a>\n<br/><br/>\n<a class=\"squiffy-link link-passage\" data-passage=\"thatsgreat\" role=\"link\" tabindex=\"0\">Gee, I really do love mornings!</a></p>",
		'js': function() {
			document.body.className="main-bg";
			cheery = new Audio();
			cheery.src = "audioCheery.mp3";
			cheery.load();
			cheery.play();
			cheery.loop = true;
		},
		'passages': {
			'thatsgreat': {
				'text': "<p>You feel pretty good about life right now. </p>\n<p>For a second, your mind catches on a bit of a strange memory... a moment, perhaps.</p>\n<p>And just as quickly, the thought flutters away. The winter sun streams through your bedroom window.</p>\n<p>What shall you do today?!</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"work\" role=\"link\" tabindex=\"0\">I&#39;ll probably just go to work.</a>\n<br />\n<br />\n<a class=\"squiffy-link link-section\" data-section=\"bs\" role=\"link\" tabindex=\"0\">I&#39;ll probably just go perform a quick ritualistic blood sacrifice.</a></p>",
			},
		},
	},
	'work': {
		'text': "<p>What an idea!</p>\n<p>And will you be cycling or walking there?</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"headin\" role=\"link\" tabindex=\"0\">Cycling!</a>\n<br/><br/>\n<a class=\"squiffy-link link-section\" data-section=\"headin\" role=\"link\" tabindex=\"0\">Walking!</a></p>",
		'passages': {
		},
	},
	'bs': {
		'text': "<p>Uh... hm. I&#39;m going to pretend you didn&#39;t suggest that.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"work\" role=\"link\" tabindex=\"0\">I&#39;ll probably just go to work.</a></p>",
		'passages': {
		},
	},
	'headin': {
		'text': "<p>Excellent. You head on into work and get there on time.</p>\n<div class=\"narrator\">Go you!</div>\n\n<p><a class=\"squiffy-link link-section\" data-section=\"Do some work.\" role=\"link\" tabindex=\"0\">Do some work.</a></p>",
		'passages': {
		},
	},
	'Do some work.': {
		'text': "<p>beep boop.</p>\n<p>beep beep boop.</p>\n<p><a class=\"squiffy-link link-passage\" data-passage=\"more1\" role=\"link\" tabindex=\"0\">Do some more work.</a></p>",
		'passages': {
			'more1': {
				'text': "<p><em>printer noise</em></p>\n<p><em>printer noise</em></p>\n<p><em>stapler noise</em></p>\n<p><a class=\"squiffy-link link-passage\" data-passage=\"more2\" role=\"link\" tabindex=\"0\">Do some more work.</a></p>",
			},
			'more2': {
				'text': "<p>Uh...</p>\n<p><em>coffee maker noise</em></p>\n<p><em>low hum of office noise</em></p>\n<div class=\"narrator\">God, this is boring.</div>\n\n<p><a class=\"squiffy-link link-passage\" data-passage=\"more3\" role=\"link\" tabindex=\"0\">do some more work</a></p>",
			},
			'more3': {
				'text': "<p>Alright, it&#39;s time to head home.</p>\n<p>Looks like it&#39;s raining outside. Which would you rather do?</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"Walk\" role=\"link\" tabindex=\"0\">Walk</a>\n<br /><br />\n<a class=\"squiffy-link link-section\" data-section=\"Take the bus\" role=\"link\" tabindex=\"0\">Take the bus</a></p>",
			},
		},
	},
	'Walk': {
		'text': "<p>Odd choice, but alright. </p>\n<p>You bid farewell to your coworkers and head out.</p>\n<p>As you&#39;re walking down the street, you see a <a class=\"squiffy-link link-section\" data-section=\"firstsight\" role=\"link\" tabindex=\"0\">man</a> unlocking his front door.</p>",
		'passages': {
		},
	},
	'Take the bus': {
		'text': "<p>Makes sense.</p>\n<p>You bid farewell to your coworkers and head out.</p>\n<p>You get on the bus uneventfully, and get off at your stop.</p>\n<p>When you step off the bus, you see a <a class=\"squiffy-link link-section\" data-section=\"firstsight\" role=\"link\" tabindex=\"0\">man</a> unlocking his front door.</p>",
		'passages': {
		},
	},
	'firstsight': {
		'clear': true,
		'text': "<p>You&#39;re confused, at first. Then you start...</p>\n<p><a class=\"squiffy-link link-passage\" data-passage=\"f1\" role=\"link\" tabindex=\"0\">...to</a></p>",
		'js': function() {
			cheery.pause();
		},
		'passages': {
			'f1': {
				'text': "<p><a class=\"squiffy-link link-passage\" data-passage=\"f2\" role=\"link\" tabindex=\"0\">...feel</a></p>",
			},
			'f2': {
				'text': "<div id=\"fainting-dizzy\">...a bit dizzy.</div>\n<br /><br />\n\n<div id=\"fainting-next\"><a class=\"squiffy-link link-section\" data-section=\"Continue\" role=\"link\" tabindex=\"0\">Continue</a></div>",
				'js': function() {
					document.body.className="fainting-bg";
				},
			},
		},
	},
	'Continue': {
		'text': "<p>Blah</p>",
		'passages': {
		},
	},
}
})();