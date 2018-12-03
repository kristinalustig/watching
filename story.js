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
		'clear': true,
		'text': "<p><img src=\"images/coverIntro.png\" id=\"introImage\" /></p>\n<div id=\"introText\">Turn on sound, and <a class=\"squiffy-link link-section\" data-section=\"begin.\" role=\"link\" tabindex=\"0\">begin.</a></div>\n\n<!--<a class=\"squiffy-link link-section\" data-section=\"leaveLR\" role=\"link\" tabindex=\"0\">DEV cut to end of intro</a>\n\n//<a class=\"squiffy-link link-section\" data-section=\"firstsight\" role=\"link\" tabindex=\"0\">DEV cut to fainting</a>\n\n//<a class=\"squiffy-link link-section\" data-section=\"closer look\" role=\"link\" tabindex=\"0\">DEV cut to closerlook</a>\n\n//<a class=\"squiffy-link link-section\" data-section=\"Leave the house.\" role=\"link\" tabindex=\"0\">DEV cut to leave the house</a>-->",
		'js': function() {
			static = new Audio();
			cheery = new Audio();
			creepy = new Audio();
			document.body.className="introClass";
		},
		'passages': {
		},
	},
	'begin.': {
		'clear': true,
		'text': "<p><img src=\"images/Snow.png\" class=\"floatingsnow\" style=\"width:10%; animation-delay: 1s;\"/>\n<img src=\"images/Snow.png\" class=\"floatingsnow\" style=\"width:10%; animation-delay: 5s;\"/>\n<img src=\"images/Snow.png\" class=\"floatingsnow\" style=\"width:15%; animation-delay: 8s;\"/>\n<img src=\"images/Snow.png\" class=\"floatingsnow\" style=\"width:12%; animation-delay: 12s;\"/></p>\n<p>It&#39;s a snowy November evening. You were watching TV after dinner (as per usual) and you fell asleep on the couch. </p>\n<p>Again.</p>\n<p>{sequence:Zzz.:Oh, come now, when&#39;s the last time you even made your bed?:You don&#39;t even have a pillow!:To be honest, I&#39;m not very impressed with you right now.:<a class=\"squiffy-link link-section\" data-section=\"waking up\" role=\"link\" tabindex=\"0\">I mean, doesn&#39;t your back hurt?</a>}</p>",
		'js': function() {
			creepy.src = "creepy.mp3";
			creepy.load();
			creepy.play();
			creepy.loop = true;
			set ("creepy",creepy);
		},
		'passages': {
		},
	},
	'waking up': {
		'text': "<p>Ahem...</p>\n<p>Right, well, your back is killing you when you wake up. You open your eyes again and when you glance at the clock, you see that it&#39;s around 3AM. </p>\n<p>The glow of the TV has painted the room in blues and greys. It&#39;s like it has sucked all of the warmth out of the world.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"Get off the couch\" role=\"link\" tabindex=\"0\">Get off the couch</a>\n <br /><br />\n<a class=\"squiffy-link link-section\" data-section=\"Shut your eyes again\" role=\"link\" tabindex=\"0\">Shut your eyes again</a></p>",
		'js': function() {
			document.body.className = 'dim';
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
		'text': "<p>The TV buzzes loudly, and you look to see that static has filled the screen. </p>\n<p>Through the static, a voice wavers...</p>\n<div class=\"badguy\">Hello in there.</div>\n\n<p><br /></p>\n<p><a class=\"squiffy-link link-section\" data-section=\"wtf\" role=\"link\" tabindex=\"0\">&quot;What in the hell?&quot;</a>\n<br /><br />\n<a class=\"squiffy-link link-section\" data-section=\"hello\" role=\"link\" tabindex=\"0\">&quot;Who are you, and what are you doing in my...&quot;</a></p>",
		'js': function() {
			creepy.pause();
			static.src = "static.wav";
			static.load();
			static.play();
			static.volume = .1;
			set ("static",static);
		},
		'passages': {
		},
	},
	'wtf': {
		'text': "<div class=\"badguy\">Technically not <em>in</em> hell... at least not right now. Moreso in your television, aren&#39;t I?</div>\n\n<p><a class=\"squiffy-link link-section\" data-section=\"...\" role=\"link\" tabindex=\"0\">...</a></p>",
		'passages': {
		},
	},
	'hello': {
		'text': "<div class=\"badguy\">Television, yes, and aren&#39;t <em>we</em> playing it cool as a cucumber?</div>\n\n<p><a class=\"squiffy-link link-section\" data-section=\"...\" role=\"link\" tabindex=\"0\">...</a></p>",
		'passages': {
		},
	},
	'...': {
		'text': "<div class=\"badguy\">We have much to discuss. Please, come closer.</div>\n\n<p>The static wavers for a moment, and through the static you can just make out a human-like shape blending into the darkest greys and blacks.</p>\n<p>You start to find this wavery voice pretty annoying, frankly.</p>\n<p>...and also, mildly terrifying?</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"closerTV\" role=\"link\" tabindex=\"0\">Move closer to the television.</a></p>\n<p><a class=\"squiffy-link link-section\" data-section=\"leaveLR\" role=\"link\" tabindex=\"0\">You&#39;re right, I don&#39;t like this. I&#39;m going to leave.</a></p>",
		'passages': {
		},
	},
	'closerTV': {
		'text': "<div class=\"narrator\">interesting choice.</div>\n\n<p>You start to walk towards the television; its pulsing glow is magnetic.</p>\n<p>You gently place your fingertips on the screen, <a class=\"squiffy-link link-section\" data-section=\"titlescreen\" role=\"link\" tabindex=\"0\">and</a></p>",
		'passages': {
		},
	},
	'leaveLR': {
		'text': "<div class=\"narrator\">yeahhh, that&#39;s not going to work, though</div>\n\n<p>When you try to leave, you make it a couple of steps towards the <a class=\"squiffy-link link-section\" data-section=\"titlescreen\" role=\"link\" tabindex=\"0\">door...</a></p>",
		'passages': {
		},
	},
	'titlescreen': {
		'clear': true,
		'text': "<div style=\"font-size:.7em; opacity:0; font-style:italic; color: white; text-align:center; margin-top:-20px; animation-name:disappear; animation-duration:40s;\">A text &quot;adventure&quot; by @kristinalustig for Ludum Dare 43.</div>\n<br />\n\n<div id=\"blammonext\"><a class=\"squiffy-link link-section\" data-section=\"Actually Begin.\" role=\"link\" tabindex=\"0\">Actually Begin.</a></div>",
		'js': function() {
			document.getElementById("pageheader").className="blammo";
			document.body.className="blammobody";
		},
		'passages': {
		},
	},
	'Actually Begin.': {
		'text': "<p>You wake up nice and snuggly in your bed. When you stand up, you feel well-rested, too!</p>\n<p><a class=\"squiffy-link link-passage\" data-passage=\"thatsgreat\" role=\"link\" tabindex=\"0\">That&#39;s... great?</a>\n<br/><br/>\n<a class=\"squiffy-link link-passage\" data-passage=\"thatsgreat\" role=\"link\" tabindex=\"0\">Gee, I really do love mornings!</a></p>",
		'js': function() {
			document.body.className="main-bg";
			cheery.src = "audioCheery.mp3";
			cheery.load();
			cheery.play();
			cheery.loop = true;
		},
		'passages': {
			'thatsgreat': {
				'text': "<p>Yeah, you feel pretty good about life right now. </p>\n<p>For a second, your mind catches on a bit of a strange memory... a moment, perhaps.</p>\n<p>And just as quickly, the thought flutters away. The winter sun streams through your bedroom window.</p>\n<p>What shall you do today?!</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"work\" role=\"link\" tabindex=\"0\">I&#39;ll probably just go to work.</a>\n<br />\n<br />\n<a class=\"squiffy-link link-section\" data-section=\"bs\" role=\"link\" tabindex=\"0\">I&#39;ll probably just go perform a quick ritualistic blood sacrifice.</a></p>",
			},
		},
	},
	'work': {
		'clear': true,
		'text': "<p><img src=\"images/coverOne.png\" class=\"imageIntro\" /></p>\n<p>What an idea!</p>\n<p>And will you be cycling or walking there?</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"headin\" role=\"link\" tabindex=\"0\">Cycling!</a>\n<br/><br/>\n<a class=\"squiffy-link link-section\" data-section=\"headin\" role=\"link\" tabindex=\"0\">Walking!</a></p>",
		'passages': {
		},
	},
	'bs': {
		'text': "<p>Uh... hm. I&#39;m going to pretend you didn&#39;t suggest that.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"work\" role=\"link\" tabindex=\"0\">I&#39;ll probably just go to work.</a></p>",
		'passages': {
		},
	},
	'headin': {
		'text': "<p>Excellent choice. You head on into work and get there on time.</p>\n<div class=\"narrator\">go you!</div>\n\n<p><a class=\"squiffy-link link-section\" data-section=\"Do some work.\" role=\"link\" tabindex=\"0\">Do some work.</a></p>",
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
				'text': "<p>Uh...</p>\n<p><em>coffee maker noise</em></p>\n<p><em>low hum of office noise</em></p>\n<div class=\"narrator\">god, this is boring</div>\n\n<p><a class=\"squiffy-link link-passage\" data-passage=\"more3\" role=\"link\" tabindex=\"0\">do some more work</a></p>",
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
		'text': "<p><img src=\"images/coverPartTwo.png\" class=\"imageIntro\" /></p>\n<p>You&#39;re confused, at first. Then you start...</p>\n<p><a class=\"squiffy-link link-passage\" data-passage=\"f1\" role=\"link\" tabindex=\"0\">...to</a></p>",
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
		'text': "<div style=\"color:white; line-height:1.5em;\">\n\n<p>You come to.<br/><br/></p>\n<p>Your head feels like a rusty garbage can, and when you lift your hand up to touch, it feels hot and wet.\n<br/><br/>\n&quot;Hey, careful, don&#39;t touch! I&#39;m trying to clean it.&quot; You hear a man&#39;s voice.\n<br/><br/>\n&quot;What happened? Do you faint like that a lot?&quot; he asks. He sounds deeply concerned. </div>\n<br/><br/>\n<a class=\"squiffy-link link-section\" data-section=\"niceroute\" role=\"link\" tabindex=\"0\">&quot;Hey, thank you for helping me.&quot;</a>\n<br /><br />\n<a class=\"squiffy-link link-section\" data-section=\"meanroute\" role=\"link\" tabindex=\"0\">&quot;What are you doing? Am I in your house?&quot;</a>\n<br /><br />\n<a class=\"squiffy-link link-section\" data-section=\"confusedroute\" role=\"link\" tabindex=\"0\">&quot;What even happened? Where am I?&quot;</a></p>",
		'passages': {
		},
	},
	'niceroute': {
		'clear': true,
		'text': "<p>You thank him.</p>\n<p>You squint open your eyes and make out the figure of the man you remember seeing right before you passed out.</p>\n<p>&quot;Don&#39;t even mention it! I saw you fall as I was coming into my house, so I brought you here to give you some ice and clean out that scrape.&quot;</p>\n<p>You get a bit of a <a class=\"squiffy-link link-section\" data-section=\"closer look\" role=\"link\" tabindex=\"0\">closer look</a> at him.</p>",
		'js': function() {
			document.body.className="main-bg";
		},
		'passages': {
		},
	},
	'meanroute': {
		'clear': true,
		'text': "<p>You squint open your eyes and make out the figure of the man you remember seeing right before you passed out.</p>\n<p>You sit up, worried, and start questioning him. He looks taken aback.</p>\n<p>&quot;I mean, I saw you fall... I was just trying to help! Yes, you&#39;re in my house!&quot;</p>\n<p>You get a bit of a <a class=\"squiffy-link link-section\" data-section=\"closer look\" role=\"link\" tabindex=\"0\">closer look</a> at him.</p>",
		'js': function() {
			document.body.className="main-bg";
		},
		'passages': {
		},
	},
	'confusedroute': {
		'clear': true,
		'text': "<p>You&#39;re confused.</p>\n<p>You squint open your eyes and make out the figure of the man you remember seeing right before you passed out.</p>\n<p>&quot;Well, I saw you hit the ground pretty hard, so I came and brought you a few steps to my house to clean you up.&quot;</p>\n<p>You get a bit of a <a class=\"squiffy-link link-section\" data-section=\"closer look\" role=\"link\" tabindex=\"0\">closer look</a> at him.</p>",
		'js': function() {
			document.body.className="main-bg";
		},
		'passages': {
		},
	},
	'closer look': {
		'text': "<p>You sit up a bit and squint at him even more.</p>\n<p>At first glance, he seems pretty average. Balding, brown hair, wire-rimmed glasses. Wearing khakis and a tucked-in shirt with a electronics store logo on it.</p>\n<p>But there&#39;s something... somehow... not quite right about him. You&#39;re not sure, but then you <em>are</em>. Something&#39;s not right.</p>\n<p><a class=\"squiffy-link link-passage\" data-passage=\"Look around the room.\" role=\"link\" tabindex=\"0\">Look around the room.</a>\n<br /><br />\n<a class=\"squiffy-link link-passage\" data-passage=\"Ask for some water.\" role=\"link\" tabindex=\"0\">Ask for some water.</a>\n<br /><br />\n<a class=\"squiffy-link link-passage\" data-passage=\"Ask for his name.\" role=\"link\" tabindex=\"0\">Ask for his name.</a></p>",
		'passages': {
			'Look around the room.': {
				'text': "<p>You start to take in your surroundings. You&#39;re in a pretty nondescript living room. Saggy couch, particle board coffee table, television with some video games stacked below.</p>\n<p><a class=\"squiffy-link link-passage\" data-passage=\"Turn on the TV.\" role=\"link\" tabindex=\"0\">Turn on the TV.</a></p>",
			},
			'Turn on the TV.': {
				'text': "<p>You reach over for the remote.</p>\n<p>&quot;Oh, ah, well. I suppose if you need to rest and recover for a bit?&quot;</p>\n<p>You turn on the TV. It&#39;s showing some sort of Japanese cartoon.</p>\n<div class=\"narrator\">is now really the time?</div>",
			},
			'Ask for some water.': {
				'text': "<p>You ask the man for some water.</p>\n<p>&quot;Ah, of course! So sorry, give me a moment.&quot; He scurries off to the kitcken.</p>\n<p>He seems nervous.</p>\n<p>You feel uneasy.</p>\n<p>He comes back in a moment with a bottle of water. You unscrew the cap and take a sip.</p>",
			},
			'Ask for his name.': {
				'text': "<p>&quot;Hey, what&#39;s...&quot; Your voice is hoarse and it catches a bit in your throat.</p>\n<p>You try again. &quot;What&#39;s your name?&quot;</p>\n<p>He looks startled. &quot;Jake. It&#39;s Jake, my name is Jake.&quot; </p>\n<div class=\"narrator\">why in the world is he <em>so</em> nervous?</div>\n\n\n\n<p><a class=\"squiffy-link link-section\" data-section=\"memory\" role=\"link\" tabindex=\"0\">Hang on a second...</a></p>",
			},
		},
	},
	'memory': {
		'clear': true,
		'text': "<p>Suddenly, your memory flashes.</p>\n<p>{sequence:Your couch, cast in fuzzy grey.:A commanding, sinister voice.:A snowflake falling on the tip of your nose.:<a class=\"squiffy-link link-section\" data-section=\"Blood running down a drain.\" role=\"link\" tabindex=\"0\">Blood running down a drain.</a>}</p>",
		'js': function() {
			document.body.className="memoryflashes";
		},
		'passages': {
		},
	},
	'Blood running down a drain.': {
		'text': "<p>You know what you have to do.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"I do.\" role=\"link\" tabindex=\"0\">I do.</a></p>",
		'js': function() {
			document.body.className="";
		},
		'passages': {
		},
	},
	'I do.': {
		'clear': true,
		'text': "<p><img src=\"images/coverPart3.png\" class=\"imageIntro\" /></p>\n<p>You look over at Jake. He&#39;s starting to sweat a bit: you see small beads forming at his temples.</p>\n<p>&quot;W... what&#39;s your name?&quot;</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"doesitmatter\" role=\"link\" tabindex=\"0\">&quot;Does it matter?&quot;</a></p>",
		'passages': {
		},
	},
	'doesitmatter': {
		'text': "<p>You deflect and he blinks. His eyes flicker to the door.</p>\n<p>&quot;I guess you&#39;re right? Uh... do you want some water?&quot;</p>\n<p><div class=\"narrator\">um, hey there? What&#39;s the deal? why were you so rude to him just now?</div>\n<br/><br/>\n<a class=\"squiffy-link link-section\" data-section=\"gogetwater\" role=\"link\" tabindex=\"0\">&quot;I can get it myself.&quot;</a></p>",
		'passages': {
		},
	},
	'gogetwater': {
		'text': "<p>You pick up the glass and start walking towards the kitchen.</p>\n<p>You feel a little bit like your limbs are motorized.</p>\n<p>Like you don&#39;t <em>really</em> want to go get yourself some water.</p>\n<p>But you do.\n<br/><br/>\n<a class=\"squiffy-link link-section\" data-section=\"knife\" role=\"link\" tabindex=\"0\">Grab knife from knife block</a></p>",
		'passages': {
		},
	},
	'knife': {
		'text': "<p><br/><br/></p>\n<div class=\"narrator\">okay, very funny. you can put that down now.</div>\n\n<p>You put the glass in the sink.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"waterlie\" role=\"link\" tabindex=\"0\">&quot;Hey, Jake? There&#39;s something wrong with the water.&quot;</a></p>",
		'passages': {
		},
	},
	'waterlie': {
		'text': "<p>Jake hears you call and walks into the kitchen.</p>\n<p>&quot;Oh, the faucet is a bit touchy, if you just&quot;</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"Grab Jake.\" role=\"link\" tabindex=\"0\">Grab Jake.</a></p>\n<div class=\"narrator\">oh my goodness, what are you DOING? If you would just...</div>",
		'passages': {
		},
	},
	'Grab Jake.': {
		'text': "<p>You grab Jake as he walks in.</p>\n<p>With a smooth motion, before he can react, you plunge the knife into his stomach.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"Leave the house.\" role=\"link\" tabindex=\"0\">Leave the house.</a></p>",
		'passages': {
		},
	},
	'Leave the house.': {
		'text': "<p>You leave the kitchen and head back into the living room.</p>\n<p>As you pass the <a class=\"squiffy-link link-section\" data-section=\"TVoutro\" role=\"link\" tabindex=\"0\">TV,</a></p>",
		'passages': {
		},
	},
	'TVoutro': {
		'clear': true,
		'text': "<div class=\"badguy\">Well done.</div>\n\n<p>You shake your head, trying to clear out some of the fog.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"brainfog\" role=\"link\" tabindex=\"0\">&quot;What are you talking about?&quot;</a></p>",
		'js': function() {
			document.body.className="dim";
			static.src = "static.wav";
			static.load();
			static.play();
			static.volume = .1;
		},
		'passages': {
		},
	},
	'brainfog': {
		'text': "<div class=\"badguy\">Don&#39;t worry. We have time. </div>\n\n<div class=\"badguy\">And, well.</div>\n\n<div class=\"narrator\">oh no...</div>\n\n<p><a class=\"squiffy-link link-section\" data-section=\"um\" role=\"link\" tabindex=\"0\">...</a></p>",
		'passages': {
		},
	},
	'um': {
		'clear': true,
		'text': "<div class=\"badguy\">You have many more sacrifices to make.</div>\n\n<p>The TV blinks off.</p>\n<div class=\"narrator\">...what have you done?</div>\n\n<p><a class=\"squiffy-link link-section\" data-section=\"end\" role=\"link\" tabindex=\"0\">end</a></p>",
		'js': function() {
			static.pause();
			creepy.src = "creepy.mp3";
			creepy.load();
			creepy.play();
			creepy.loop = true;
		},
		'passages': {
		},
	},
	'end': {
		'clear': true,
		'text': "<div class=\"badguy\" style=\"font-size:3em; text-align:center; width=100%;\">\n<div>Watching</div></div>\n\n<p><br/><br/><br/><br/>\nWords, code, music, sfx, and art by <a href=\"http://www.twitter.com/kristinalustig\">@kristinalustig</a>.</p>\n<p>Made with <a href=\"http://textadventures.co.uk\">squiffy</a>.</p>\n<p>Made for <a href=\"http://ldjam.com\">Ludum Dare 43</a>.</p>\n<p>Thanks for playing.</p>\n<div class=\"narrator\">ugh, thanks for nothing</div>\n\n<p><a class=\"squiffy-link link-section\" data-section=\"Play again?\" role=\"link\" tabindex=\"0\">Play again?</a></p>",
		'js': function() {
			
		},
		'passages': {
		},
	},
	'Play again?': {
		'text': "<p>Weird. Well, <a class=\"squiffy-link link-section\" data-section=\"Beginning\" role=\"link\" tabindex=\"0\">go ahead...</a></p>",
		'js': function() {
			creepy.pause();
		},
		'passages': {
		},
	},
}
})();