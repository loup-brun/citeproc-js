/*
 * Copyright (c) 2009, 2010, 2011 and 2012 Frank G. Bennett, Jr. All Rights
 * Reserved.
 *
 * The contents of this file are subject to the Common Public
 * Attribution License Version 1.0 (the “License”); you may not use
 * this file except in compliance with the License. You may obtain a
 * copy of the License at:
 *
 * http://bitbucket.org/fbennett/citeproc-js/src/tip/LICENSE.
 *
 * The License is based on the Mozilla Public License Version 1.1 but
 * Sections 1.13, 14 and 15 have been added to cover use of software over a
 * computer network and provide for limited attribution for the
 * Original Developer. In addition, Exhibit A has been modified to be
 * consistent with Exhibit B.
 *
 * Software distributed under the License is distributed on an “AS IS”
 * basis, WITHOUT WARRANTY OF ANY KIND, either express or implied. See
 * the License for the specific language governing rights and limitations
 * under the License.
 *
 * The Original Code is the citation formatting software known as
 * "citeproc-js" (an implementation of the Citation Style Language
 * [CSL]), including the original test fixtures and software located
 * under the ./tests subdirectory of the distribution archive.
 *
 * The Original Developer is not the Initial Developer and is
 * __________. If left blank, the Original Developer is the Initial
 * Developer.
 *
 * The Initial Developer of the Original Code is Frank G. Bennett,
 * Jr. All portions of the code written by Frank G. Bennett, Jr. are
 * Copyright (c) 2009, 2010, 2011, and 2012 Frank G. Bennett, Jr. All Rights Reserved.
 *
 * Alternatively, the contents of this file may be used under the
 * terms of the GNU Affero General Public License (the [AGPLv3]
 * License), in which case the provisions of [AGPLv3] License are
 * applicable instead of those above. If you wish to allow use of your
 * version of this file only under the terms of the [AGPLv3] License
 * and not to allow others to use your version of this file under the
 * CPAL, indicate your decision by deleting the provisions above and
 * replace them with the notice and other provisions required by the
 * [AGPLv3] License. If you do not delete the provisions above, a
 * recipient may use your version of this file under either the CPAL
 * or the [AGPLv3] License.”
 */

/*global CSL: true */

CSL.localeResolve = function (langstr) {
    var ret, langlst;
    ret = {};
    //if ("undefined" === typeof langstr) {
    //    langstr = "en_US";
    //}
    langlst = langstr.split(/[\-_]/);
    ret.base = CSL.LANG_BASES[langlst[0]];
    if ("undefined" === typeof ret.base) {
        CSL.debug("Warning: unknown locale "+langstr+", setting fallback to en-US");
        return {base:"en-US", best:langstr, bare:langlst[0]};
    }
    if (langlst.length === 1 || langlst[1] === "x") {
        ret.best = ret.base.replace("_", "-");
    } else {
        ret.best = langlst.slice(0, 2).join("-");
    }
    ret.base = ret.base.replace("_", "-");
    ret.bare = langlst[0];
    return ret;
};

CSL.localeParse = function (arg) {
    // 
    // Needs fixing.  How do we make the hyphen optional,
    // but, you know, required?
    // 
    //if (arg.match(/^\s+([a-zA-Z]{2})(?:-([a-zA-Z]{2})(?:[^a-zA-Z]|$))/)) {
    //    
    //}
    return arg;
};

// Use call to invoke this.
CSL.Engine.prototype.localeConfigure = function (langspec) {
    var localexml;
    localexml = this.sys.xml.makeXml(this.sys.retrieveLocale("en-US"));
    this.localeSet(localexml, "en-US", langspec.best);
    if (langspec.best !== "en-US") {
        if (langspec.base !== langspec.best) {
            localexml = this.sys.xml.makeXml(this.sys.retrieveLocale(langspec.base));
            this.localeSet(localexml, langspec.base, langspec.best);
        }
        localexml = this.sys.xml.makeXml(this.sys.retrieveLocale(langspec.best));
        this.localeSet(localexml, langspec.best, langspec.best);        
    }
    this.localeSet(this.cslXml, "", langspec.best);
    this.localeSet(this.cslXml, langspec.bare, langspec.best);
    if (langspec.base !== langspec.best) {
        this.localeSet(this.cslXml, langspec.base, langspec.best);
    }
    this.localeSet(this.cslXml, langspec.best, langspec.best);
    if ("undefined" === typeof this.locale[langspec.best].terms["page-range-delimiter"]) {
        if (["fr", "pt"].indexOf(langspec.best.slice(0, 2).toLowerCase()) > -1) {
            this.locale[langspec.best].terms["page-range-delimiter"] = "-";
        } else {
            this.locale[langspec.best].terms["page-range-delimiter"] = "\u2013";
        }
    }
    if ("undefined" === typeof this.locale[langspec.best].terms["year-range-delimiter"]) {
        this.locale[langspec.best].terms["year-range-delimiter"] = "\u2013";
    }
    if ("undefined" === typeof this.locale[langspec.best].terms["citation-range-delimiter"]) {
        this.locale[langspec.best].terms["citation-range-delimiter"] = "\u2013";
    }
};
    
//
// XXXXX: Got it.  The locales objects need to be reorganized,
// with a top-level local specifier, and terms, opts, dates
// below.
//
CSL.Engine.prototype.localeSet = function (myxml, lang_in, lang_out) {
    var blob, locale, nodes, attributes, pos, ppos, term, form, termname, styleopts, attr, date, attrname, len, genderform, target, i, ilen;
    lang_in = lang_in.replace("_", "-");
    lang_out = lang_out.replace("_", "-");

    if (!this.locale[lang_out]) {
        this.locale[lang_out] = {};
        this.locale[lang_out].terms = {};
        this.locale[lang_out].opts = {};
        // Set default skip words. Can be overridden in locale by attribute on style-options node.
        this.locale[lang_out].opts["skip-words"] = CSL.SKIP_WORDS;
        this.locale[lang_out].dates = {};
        // For ordinals
        this.locale[lang_out].ord = {'1.0.1':false,keys:{}};
        this.locale[lang_out]["noun-genders"] = {};
    }

    //
    // Xml: Test if node is "locale" (nb: ns declarations need to be invoked
    // on every access to the xml object; bundle this with the functions
    //
    locale = this.sys.xml.makeXml();
    if (this.sys.xml.nodeNameIs(myxml, 'locale')) {
        locale = myxml;
    } else {
        //
        // Xml: get a list of all "locale" nodes
        //
        nodes = this.sys.xml.getNodesByName(myxml, "locale");
        for (pos = 0, len = this.sys.xml.numberofnodes(nodes); pos < len; pos += 1) {
            blob = nodes[pos];
            //
            // Xml: get locale xml:lang
            //
            if (this.sys.xml.getAttributeValue(blob, 'lang', 'xml') === lang_in) {
                locale = blob;
                break;
            }
        }
    }
    //
    // Xml: get a list of any cs:type nodes within locale
    //
    nodes = this.sys.xml.getNodesByName(locale, 'type');
    for (i = 0, ilen = this.sys.xml.numberofnodes(nodes); i < ilen; i += 1) {
        var typenode = nodes[i];
        var type = this.sys.xml.getAttributeValue(typenode, 'name');
        var gender = this.sys.xml.getAttributeValue(typenode, 'gender');
        this.opt.gender[type] = gender;
    }
    //
    // Xml: get a list of term nodes within locale
    //

    // If we are setting CSL 1.0.1 ordinals inside a style, wipe the
    // slate clean and start over.
    var hasCslOrdinals101 = this.sys.xml.getNodesByName(locale, 'term', 'ordinal').length;
    if (hasCslOrdinals101) {
        for (var key in this.locale[lang_out].ord.keys) {
            delete this.locale[lang_out].terms[key];
        }
        this.locale[lang_out].ord = {"1.0.1":false,keys:{}};
    }

    nodes = this.sys.xml.getNodesByName(locale, 'term');
    // Collect ordinals info as for 1.0.1, but save only if 1.0.1 toggle triggers
    var ordinals101 = {"last-digit":{},"last-two-digits":{},"whole-number":{}};
    var ordinals101_toggle = false;
    var genderized_terms = {};
    for (pos = 0, len = this.sys.xml.numberofnodes(nodes); pos < len; pos += 1) {
        term = nodes[pos];
        //
        // Xml: get string value of attribute
        //
        termname = this.sys.xml.getAttributeValue(term, 'name');
        if (termname === "sub verbo") {
            termname = "sub-verbo";
        }
        if (termname.slice(0,7) === "ordinal") {
            var termstring = this.sys.xml.getNodeValue(term);
            if (termname === "ordinal") {
                ordinals101_toggle = true;
            } else {
                var match = this.sys.xml.getAttributeValue(term, 'match');
                var termstub = termname.slice(8);
                var genderform = this.sys.xml.getAttributeValue(term, 'gender-form');
                if (!genderform) {
                    genderform = "neuter";
                }
                if (!match) {
                    match = "last-two-digits";
                    if (termstub.slice(0,1) === "0") {
                        match = "last-digit";
                    }
                }
                if (termstub.slice(0,1) === "0") {
                    termstub = termstub.slice(1);
                }
                if (!ordinals101[match][termstub]) {
                    ordinals101[match][termstub] = {};
                }
                ordinals101[match][termstub][genderform] = termname;
            }
            this.locale[lang_out].ord.keys[termname] = true;
        }
        if ("undefined" === typeof this.locale[lang_out].terms[termname]) {
            this.locale[lang_out].terms[termname] = {};
        }
        form = "long";
        genderform = false;
        //
        // Xml: get string value of form attribute, if any
        //
        if (this.sys.xml.getAttributeValue(term, 'form')) {
            form = this.sys.xml.getAttributeValue(term, 'form');
        }
        //
        // Xml: get string value of gender attribute, if any
        // 
        if (this.sys.xml.getAttributeValue(term, 'gender-form')) {
            genderform = this.sys.xml.getAttributeValue(term, 'gender-form');
        }
        //
        // Xml: set global gender assignment for variable associated
        // with term name
        // 
        if (this.sys.xml.getAttributeValue(term, 'gender')) {
            this.locale[lang_out]["noun-genders"][termname] = this.sys.xml.getAttributeValue(term, 'gender');
        }
        // Work on main segment or gender-specific sub-segment as appropriate
        if (genderform) {
            this.locale[lang_out].terms[termname][genderform] = {};
            this.locale[lang_out].terms[termname][genderform][form] = [];
            target = this.locale[lang_out].terms[termname][genderform];
            genderized_terms[termname] = true;
        } else {
            this.locale[lang_out].terms[termname][form] = [];
            target = this.locale[lang_out].terms[termname];
        }
        //
        // Xml: test of existence of node
        //
        if (this.sys.xml.numberofnodes(this.sys.xml.getNodesByName(term, 'multiple'))) {
            //
            // Xml: get string value of attribute, plus
            // Xml: get string value of node content
            //
            target[form][0] = this.sys.xml.getNodeValue(term, 'single');
            //
            // Xml: get string value of attribute, plus
            // Xml: get string value of node content
            //
            target[form][1] = this.sys.xml.getNodeValue(term, 'multiple');
        } else {
            //
            // Xml: get string value of attribute, plus
            // Xml: get string value of node content
            //
            target[form] = this.sys.xml.getNodeValue(term);
        }
    }
    // If locale had a CSL 1.0.1-style ordinal definition, install the logic object
    // and iterate over gendered terms, filling in default values for use by getTerm.
    if (ordinals101_toggle) {
        for (var ikey in genderized_terms) {
            var gender_segments = {};
            var form_segments = 0;
            for (var jkey in this.locale[lang_out].terms[ikey]) {
                if (["masculine","feminine"].indexOf(jkey) > -1) {
                    gender_segments[jkey] = this.locale[lang_out].terms[ikey][jkey];
                } else {
                    form_segments += 1;
                }
            }
            if (!form_segments) {
                if (gender_segments.feminine) {
                    // Link each feminine form segment to default
                    // (no need to filter, these will not have gender segments mixed in)
                    for (var jkey in gender_segments.feminine) {
                        this.locale[lang_out].terms[ikey][jkey] = gender_segments.feminine[jkey];
                    }
                } else if (gender_segments.masculine) {
                    // Otherwise link each masculine form segment to default 
                    for (var jkey in gender_segments.masculine) {
                        this.locale[lang_out].terms[ikey][jkey] = gender_segments.masculine[jkey];
                    }
                }
            }
        }
        this.locale[lang_out].ord['1.0.1'] = ordinals101;
    }

    // Iterate over main segments, and fill in any holes in gender-specific data
    // sub-segments
    for (termname in this.locale[lang_out].terms) {
        for (i = 0, ilen = 2; i < ilen; i += 1) {
            genderform = CSL.GENDERS[i];
            if (this.locale[lang_out].terms[termname][genderform]) {
                for (form in this.locale[lang_out].terms[termname]) {
                    if (!this.locale[lang_out].terms[termname][genderform][form]) {
                        this.locale[lang_out].terms[termname][genderform][form] = this.locale[lang_out].terms[termname][form];
                    }
                }
            }
        }
    }
    //
    // Xml: get list of nodes by node type
    //
    nodes = this.sys.xml.getNodesByName(locale, 'style-options');
    for (pos = 0, len = this.sys.xml.numberofnodes(nodes); pos < len; pos += 1) {
        if (true) {
            styleopts = nodes[pos];
            //
            // Xml: get list of attributes on a node
            //
            attributes = this.sys.xml.attributes(styleopts);
            for (attrname in attributes) {
                if (attributes.hasOwnProperty(attrname)) {
                    if (attrname === "@punctuation-in-quote" || attrname === "@limit-day-ordinals-to-day-1") {
                        if (attributes[attrname] === "true") {
                            // trim off leading @
                            this.locale[lang_out].opts[attrname.slice(1)] = true;
                        } else {
                            // trim off leading @
                            this.locale[lang_out].opts[attrname.slice(1)] = false;
                        }
                    } else if (attrname === "@skip-words") {
                        var skip_words = attributes[attrname].split(/\s+/);
                        this.locale[lang_out].opts[attrname.slice(1)] = skip_words;
                    }
                }
            }
        }
    }
    //
    // Xml: get list of nodes by type
    //
    nodes = this.sys.xml.getNodesByName(locale, 'date');
    for (pos = 0, len = this.sys.xml.numberofnodes(nodes); pos < len; pos += 1) {
        if (true) {
            date = nodes[pos];
            //
            // Xml: get string value of attribute
            //
            this.locale[lang_out].dates[this.sys.xml.getAttributeValue(date, "form")] = date;
        }
    }
};

