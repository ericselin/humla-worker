const pad = (nr)=>nr.toString().padStart(2, "0")
;
const format = (d)=>`${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
;
const formatDM = (d, m)=>`${new Date().getFullYear()}-${pad(m)}-${pad(d)}`
;
const sundayDate = ()=>{
    const d = new Date();
    d.setDate(d.getDate() + (7 - (d.getDay() || 7)));
    return d;
};
const today = ()=>format(new Date())
;
const sunday = ()=>format(sundayDate())
;
const thisMonday = ()=>{
    const d = sundayDate();
    d.setDate(d.getDate() - 6);
    return format(d);
};
const parseDate = (dateStr)=>{
    switch(dateStr.toLowerCase()){
        case "l":
            return "later";
        case "s":
            return "someday";
        case "today":
        case "t":
            return format(new Date());
        case "tomorrow":
        case "tm":
            {
                const d = new Date();
                d.setDate(new Date().getDate() + 1);
                return format(d);
            }
        case "this week":
        case "tw":
            return format(sundayDate());
        case "next week":
        case "nw":
            {
                const d = sundayDate();
                d.setDate(d.getDate() + 7);
                return format(d);
            }
        default:
            {
                const date = /^(\d{1,2})\.(\d{1,2})/;
                const match = dateStr.match(date);
                if (match) {
                    const [, day, month] = match;
                    return formatDM(day, month);
                }
                return dateStr;
            }
    }
};
const groupBy = (field)=>(actions)=>{
        if (field !== "context") throw new Error("Not implemented");
        const groupMap = actions.reduce((map, action)=>{
            const context = action.done ? "Completed" : action.context || "No context";
            if (!map[context]) {
                map[context] = {
                    heading: context,
                    children: []
                };
            }
            map[context].children.push(action);
            return map;
        }, {
        });
        return Object.values(groupMap);
    }
;
const linkList = (field)=>(actions)=>actions.filter((a)=>!a.done
        ).flatMap((a)=>a[field]
        ).filter((elem, idx, arr)=>elem && arr.indexOf(elem) === idx
        ).map((elem)=>({
                url: `/${field}${field.endsWith("s") ? "" : "s"}/${elem?.substring(1)}`,
                text: elem
            })
        )
;
const renderAction = (action)=>`\n<form method="post" action="/actions.json">\n  <input type="hidden" name="id" value="${action.id}">\n  <details>\n      <summary>\n        <input type="checkbox" name="done"${action.done ? " checked" : ""}>\n        ${action.title}\n        ${action.tags.map((tag)=>`<i>${tag}</i>`
    ).join(" ")} \n        ${action.date ? `<strong><time>${action.date}</time></strong>` : ""}\n      </summary>\n      <textarea name="body" cols="50" rows="5">${action.body}</textarea>\n      <input type="submit" value="Save"/>\n  </details>\n</form>\n`
;
const renderLinkList = (links, placeholder = "\n")=>links.length ? `\n<ul>${links.map((link)=>`\n  <li><a href="${link.url}">${link.text}</a></li>`
    ).join("")}\n</ul>` : placeholder
;
const getTags = (body)=>{
    const regex = /(?:^|\s)(#\w+)/g;
    const matches = body.matchAll(regex);
    const tags = [];
    for (const match of matches){
        tags.push(match[1]);
    }
    return tags;
};
const getContext = (body)=>{
    const regex = /(?:^|\s)(@\w+)/;
    const [, context] = body.match(regex) || [];
    return context;
};
const getDate = (dateParser)=>(body)=>{
        const regex = /\B!(\w+\.?\w*)\b/;
        const [, date] = body.match(regex) || [];
        return date ? dateParser(date) : undefined;
    }
;
const getTitle = (body)=>{
    return body.split("\n")[0];
};
const filterActions = (filterer)=>(actions)=>{
        return actions.filter(filterer);
    }
;
const routes = {
    "unprocessed": {
        heading: "Unprocessed",
        filter: (action)=>!action.date && !action.done
    },
    "today": {
        heading: "Today",
        filter: (action)=>!!action.date && action.date <= today() && !action.done || action.done === today()
    },
    "week": {
        heading: "This week",
        filter: (action)=>!!action.date && (action.date >= thisMonday() && action.date <= sunday())
    },
    "later": {
        heading: "Later",
        filter: (action)=>!action.done && action.date === "later"
    },
    "someday": {
        heading: "Someday",
        filter: (action)=>!action.done && action.date === "someday"
    },
    "all": {
        heading: "All",
        filter: (action)=>!action.done
    },
    "contexts": {
        heading: "Contexts",
        searchFilter: (context)=>(action)=>!action.done && action.context === `@${context}`
    },
    "tags": {
        heading: "Tags",
        searchFilter: (tag)=>(action)=>!action.done && action.tags && action.tags.includes(`#${tag}`)
    }
};
const getSaveHandler = (saveAction)=>async (event)=>{
        const { request  } = event;
        const form = await request.formData();
        const id = form.get("id");
        const done = form.get("done");
        const body = form.get("body");
        if (id && typeof id !== "string") {
            throw new Error("Wrong id");
        }
        if (typeof body !== "string" || !body) {
            throw new Error("Wrong body");
        }
        if (done && typeof done !== "string") {
            throw new Error("Wrong body");
        }
        await saveAction({
            id,
            done,
            body
        }, event);
        let redirect = request.referrer;
        if (!id) redirect += "?focus=add";
        return new Response(`Redirecting to ${redirect}`, {
            status: 302,
            headers: {
                "Location": redirect
            }
        });
    }
;
const returnJson = (data)=>new Response(JSON.stringify(data), {
        headers: {
            "Content-Type": "application/json"
        }
    })
;
const listActions = async ()=>{
    const cache = await caches.open("v1");
    const response = await cache.match("/actions.json");
    return response?.json();
};
const saveActions = async (actions, event)=>{
    const cache = await caches.open("v1");
    const actionsSerialized = JSON.stringify(actions);
    event.waitUntil(fetch("/actions.json", {
        method: "POST",
        body: actionsSerialized,
        redirect: "manual"
    }));
    return cache.put("/actions.json", new Response(actionsSerialized));
};
const handleAssetRequest = async (request)=>{
    return await caches.match(request) || fetch(request);
};
const populateCache = async ()=>{
    const assets = [
        "/app.js", 
    ];
    const cache = await caches.open("v1");
    const actions = await cache.match("/actions.json");
    if (actions) {
        console.log("We already have some actions:", actions);
    } else {
        assets.push("/actions.json");
    }
    return cache.addAll(assets);
};
self.addEventListener("install", (event)=>{
    event.waitUntil(populateCache());
});
function bytesToUuid(bytes) {
    const bits = [
        ...bytes
    ].map((bit)=>{
        const s = bit.toString(16);
        return bit < 16 ? "0" + s : s;
    });
    return [
        ...bits.slice(0, 4),
        "-",
        ...bits.slice(4, 6),
        "-",
        ...bits.slice(6, 8),
        "-",
        ...bits.slice(8, 10),
        "-",
        ...bits.slice(10, 16), 
    ].join("");
}
function uuidToBytes(uuid) {
    const bytes = [];
    uuid.replace(/[a-fA-F0-9]{2}/g, (hex)=>{
        bytes.push(parseInt(hex, 16));
        return "";
    });
    return bytes;
}
function stringToBytes(str) {
    str = unescape(encodeURIComponent(str));
    const bytes = new Array(str.length);
    for(let i = 0; i < str.length; i++){
        bytes[i] = str.charCodeAt(i);
    }
    return bytes;
}
function createBuffer(content) {
    const arrayBuffer = new ArrayBuffer(content.length);
    const uint8Array = new Uint8Array(arrayBuffer);
    for(let i = 0; i < content.length; i++){
        uint8Array[i] = content[i];
    }
    return arrayBuffer;
}
const mod = function() {
    const bytesToUuid1 = bytesToUuid;
    const mod1 = function() {
        const UUID_RE = new RegExp("^[0-9a-f]{8}-[0-9a-f]{4}-1[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$", "i");
        function validate(id) {
            return UUID_RE.test(id);
        }
        let _nodeId;
        let _clockseq;
        let _lastMSecs = 0;
        let _lastNSecs = 0;
        function generate(options, buf, offset) {
            let i = buf && offset || 0;
            const b = buf || [];
            options = options || {
            };
            let node = options.node || _nodeId;
            let clockseq = options.clockseq !== undefined ? options.clockseq : _clockseq;
            if (node == null || clockseq == null) {
                const seedBytes = options.random || options.rng || crypto.getRandomValues(new Uint8Array(16));
                if (node == null) {
                    node = _nodeId = [
                        seedBytes[0] | 1,
                        seedBytes[1],
                        seedBytes[2],
                        seedBytes[3],
                        seedBytes[4],
                        seedBytes[5], 
                    ];
                }
                if (clockseq == null) {
                    clockseq = _clockseq = (seedBytes[6] << 8 | seedBytes[7]) & 16383;
                }
            }
            let msecs = options.msecs !== undefined ? options.msecs : new Date().getTime();
            let nsecs = options.nsecs !== undefined ? options.nsecs : _lastNSecs + 1;
            const dt = msecs - _lastMSecs + (nsecs - _lastNSecs) / 10000;
            if (dt < 0 && options.clockseq === undefined) {
                clockseq = clockseq + 1 & 16383;
            }
            if ((dt < 0 || msecs > _lastMSecs) && options.nsecs === undefined) {
                nsecs = 0;
            }
            if (nsecs >= 10000) {
                throw new Error("Can't create more than 10M uuids/sec");
            }
            _lastMSecs = msecs;
            _lastNSecs = nsecs;
            _clockseq = clockseq;
            msecs += 12219292800000;
            const tl = ((msecs & 268435455) * 10000 + nsecs) % 4294967296;
            b[i++] = tl >>> 24 & 255;
            b[i++] = tl >>> 16 & 255;
            b[i++] = tl >>> 8 & 255;
            b[i++] = tl & 255;
            const tmh = msecs / 4294967296 * 10000 & 268435455;
            b[i++] = tmh >>> 8 & 255;
            b[i++] = tmh & 255;
            b[i++] = tmh >>> 24 & 15 | 16;
            b[i++] = tmh >>> 16 & 255;
            b[i++] = clockseq >>> 8 | 128;
            b[i++] = clockseq & 255;
            for(let n = 0; n < 6; ++n){
                b[i + n] = node[n];
            }
            return buf ? buf : bytesToUuid(b);
        }
        return {
            validate,
            generate
        };
    }();
    const v1 = mod1;
    const bytesToUuid2 = bytesToUuid;
    const mod2 = function() {
        const UUID_RE = new RegExp("^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$", "i");
        function validate(id) {
            return UUID_RE.test(id);
        }
        function generate() {
            const rnds = crypto.getRandomValues(new Uint8Array(16));
            rnds[6] = rnds[6] & 15 | 64;
            rnds[8] = rnds[8] & 63 | 128;
            return bytesToUuid(rnds);
        }
        return {
            validate,
            generate
        };
    }();
    const v4 = mod2;
    const bytesToUuid3 = bytesToUuid;
    const createBuffer1 = createBuffer;
    const stringToBytes1 = stringToBytes;
    const uuidToBytes1 = uuidToBytes;
    const HEX_CHARS = "0123456789abcdef".split("");
    const EXTRA = [
        -2147483648,
        8388608,
        32768,
        128
    ];
    const SHIFT = [
        24,
        16,
        8,
        0
    ];
    const blocks = [];
    class Sha1 {
        #blocks;
        #block;
        #start;
        #bytes;
        #hBytes;
        #finalized;
        #hashed;
        #h0=1732584193;
        #h1=4023233417;
        #h2=2562383102;
        #h3=271733878;
        #h4=3285377520;
        #lastByteIndex=0;
        constructor(sharedMemory1 = false){
            this.init(sharedMemory1);
        }
        init(sharedMemory) {
            if (sharedMemory) {
                blocks[0] = blocks[16] = blocks[1] = blocks[2] = blocks[3] = blocks[4] = blocks[5] = blocks[6] = blocks[7] = blocks[8] = blocks[9] = blocks[10] = blocks[11] = blocks[12] = blocks[13] = blocks[14] = blocks[15] = 0;
                this.#blocks = blocks;
            } else {
                this.#blocks = [
                    0,
                    0,
                    0,
                    0,
                    0,
                    0,
                    0,
                    0,
                    0,
                    0,
                    0,
                    0,
                    0,
                    0,
                    0,
                    0,
                    0
                ];
            }
            this.#h0 = 1732584193;
            this.#h1 = 4023233417;
            this.#h2 = 2562383102;
            this.#h3 = 271733878;
            this.#h4 = 3285377520;
            this.#block = this.#start = this.#bytes = this.#hBytes = 0;
            this.#finalized = this.#hashed = false;
        }
        update(message) {
            if (this.#finalized) {
                return this;
            }
            let msg;
            if (message instanceof ArrayBuffer) {
                msg = new Uint8Array(message);
            } else {
                msg = message;
            }
            let index = 0;
            const length = msg.length;
            const blocks1 = this.#blocks;
            while(index < length){
                let i;
                if (this.#hashed) {
                    this.#hashed = false;
                    blocks1[0] = this.#block;
                    blocks1[16] = blocks1[1] = blocks1[2] = blocks1[3] = blocks1[4] = blocks1[5] = blocks1[6] = blocks1[7] = blocks1[8] = blocks1[9] = blocks1[10] = blocks1[11] = blocks1[12] = blocks1[13] = blocks1[14] = blocks1[15] = 0;
                }
                if (typeof msg !== "string") {
                    for(i = this.#start; index < length && i < 64; ++index){
                        blocks1[i >> 2] |= msg[index] << SHIFT[(i++) & 3];
                    }
                } else {
                    for(i = this.#start; index < length && i < 64; ++index){
                        let code = msg.charCodeAt(index);
                        if (code < 128) {
                            blocks1[i >> 2] |= code << SHIFT[(i++) & 3];
                        } else if (code < 2048) {
                            blocks1[i >> 2] |= (192 | code >> 6) << SHIFT[(i++) & 3];
                            blocks1[i >> 2] |= (128 | code & 63) << SHIFT[(i++) & 3];
                        } else if (code < 55296 || code >= 57344) {
                            blocks1[i >> 2] |= (224 | code >> 12) << SHIFT[(i++) & 3];
                            blocks1[i >> 2] |= (128 | code >> 6 & 63) << SHIFT[(i++) & 3];
                            blocks1[i >> 2] |= (128 | code & 63) << SHIFT[(i++) & 3];
                        } else {
                            code = 65536 + ((code & 1023) << 10 | msg.charCodeAt(++index) & 1023);
                            blocks1[i >> 2] |= (240 | code >> 18) << SHIFT[(i++) & 3];
                            blocks1[i >> 2] |= (128 | code >> 12 & 63) << SHIFT[(i++) & 3];
                            blocks1[i >> 2] |= (128 | code >> 6 & 63) << SHIFT[(i++) & 3];
                            blocks1[i >> 2] |= (128 | code & 63) << SHIFT[(i++) & 3];
                        }
                    }
                }
                this.#lastByteIndex = i;
                this.#bytes += i - this.#start;
                if (i >= 64) {
                    this.#block = blocks1[16];
                    this.#start = i - 64;
                    this.hash();
                    this.#hashed = true;
                } else {
                    this.#start = i;
                }
            }
            if (this.#bytes > 4294967295) {
                this.#hBytes += this.#bytes / 4294967296 >>> 0;
                this.#bytes = this.#bytes >>> 0;
            }
            return this;
        }
        finalize() {
            if (this.#finalized) {
                return;
            }
            this.#finalized = true;
            const blocks1 = this.#blocks;
            const i = this.#lastByteIndex;
            blocks1[16] = this.#block;
            blocks1[i >> 2] |= EXTRA[i & 3];
            this.#block = blocks1[16];
            if (i >= 56) {
                if (!this.#hashed) {
                    this.hash();
                }
                blocks1[0] = this.#block;
                blocks1[16] = blocks1[1] = blocks1[2] = blocks1[3] = blocks1[4] = blocks1[5] = blocks1[6] = blocks1[7] = blocks1[8] = blocks1[9] = blocks1[10] = blocks1[11] = blocks1[12] = blocks1[13] = blocks1[14] = blocks1[15] = 0;
            }
            blocks1[14] = this.#hBytes << 3 | this.#bytes >>> 29;
            blocks1[15] = this.#bytes << 3;
            this.hash();
        }
        hash() {
            let a = this.#h0;
            let b = this.#h1;
            let c = this.#h2;
            let d = this.#h3;
            let e = this.#h4;
            let f;
            let j;
            let t;
            const blocks1 = this.#blocks;
            for(j = 16; j < 80; ++j){
                t = blocks1[j - 3] ^ blocks1[j - 8] ^ blocks1[j - 14] ^ blocks1[j - 16];
                blocks1[j] = t << 1 | t >>> 31;
            }
            for(j = 0; j < 20; j += 5){
                f = b & c | ~b & d;
                t = a << 5 | a >>> 27;
                e = t + f + e + 1518500249 + blocks1[j] >>> 0;
                b = b << 30 | b >>> 2;
                f = a & b | ~a & c;
                t = e << 5 | e >>> 27;
                d = t + f + d + 1518500249 + blocks1[j + 1] >>> 0;
                a = a << 30 | a >>> 2;
                f = e & a | ~e & b;
                t = d << 5 | d >>> 27;
                c = t + f + c + 1518500249 + blocks1[j + 2] >>> 0;
                e = e << 30 | e >>> 2;
                f = d & e | ~d & a;
                t = c << 5 | c >>> 27;
                b = t + f + b + 1518500249 + blocks1[j + 3] >>> 0;
                d = d << 30 | d >>> 2;
                f = c & d | ~c & e;
                t = b << 5 | b >>> 27;
                a = t + f + a + 1518500249 + blocks1[j + 4] >>> 0;
                c = c << 30 | c >>> 2;
            }
            for(; j < 40; j += 5){
                f = b ^ c ^ d;
                t = a << 5 | a >>> 27;
                e = t + f + e + 1859775393 + blocks1[j] >>> 0;
                b = b << 30 | b >>> 2;
                f = a ^ b ^ c;
                t = e << 5 | e >>> 27;
                d = t + f + d + 1859775393 + blocks1[j + 1] >>> 0;
                a = a << 30 | a >>> 2;
                f = e ^ a ^ b;
                t = d << 5 | d >>> 27;
                c = t + f + c + 1859775393 + blocks1[j + 2] >>> 0;
                e = e << 30 | e >>> 2;
                f = d ^ e ^ a;
                t = c << 5 | c >>> 27;
                b = t + f + b + 1859775393 + blocks1[j + 3] >>> 0;
                d = d << 30 | d >>> 2;
                f = c ^ d ^ e;
                t = b << 5 | b >>> 27;
                a = t + f + a + 1859775393 + blocks1[j + 4] >>> 0;
                c = c << 30 | c >>> 2;
            }
            for(; j < 60; j += 5){
                f = b & c | b & d | c & d;
                t = a << 5 | a >>> 27;
                e = t + f + e - 1894007588 + blocks1[j] >>> 0;
                b = b << 30 | b >>> 2;
                f = a & b | a & c | b & c;
                t = e << 5 | e >>> 27;
                d = t + f + d - 1894007588 + blocks1[j + 1] >>> 0;
                a = a << 30 | a >>> 2;
                f = e & a | e & b | a & b;
                t = d << 5 | d >>> 27;
                c = t + f + c - 1894007588 + blocks1[j + 2] >>> 0;
                e = e << 30 | e >>> 2;
                f = d & e | d & a | e & a;
                t = c << 5 | c >>> 27;
                b = t + f + b - 1894007588 + blocks1[j + 3] >>> 0;
                d = d << 30 | d >>> 2;
                f = c & d | c & e | d & e;
                t = b << 5 | b >>> 27;
                a = t + f + a - 1894007588 + blocks1[j + 4] >>> 0;
                c = c << 30 | c >>> 2;
            }
            for(; j < 80; j += 5){
                f = b ^ c ^ d;
                t = a << 5 | a >>> 27;
                e = t + f + e - 899497514 + blocks1[j] >>> 0;
                b = b << 30 | b >>> 2;
                f = a ^ b ^ c;
                t = e << 5 | e >>> 27;
                d = t + f + d - 899497514 + blocks1[j + 1] >>> 0;
                a = a << 30 | a >>> 2;
                f = e ^ a ^ b;
                t = d << 5 | d >>> 27;
                c = t + f + c - 899497514 + blocks1[j + 2] >>> 0;
                e = e << 30 | e >>> 2;
                f = d ^ e ^ a;
                t = c << 5 | c >>> 27;
                b = t + f + b - 899497514 + blocks1[j + 3] >>> 0;
                d = d << 30 | d >>> 2;
                f = c ^ d ^ e;
                t = b << 5 | b >>> 27;
                a = t + f + a - 899497514 + blocks1[j + 4] >>> 0;
                c = c << 30 | c >>> 2;
            }
            this.#h0 = this.#h0 + a >>> 0;
            this.#h1 = this.#h1 + b >>> 0;
            this.#h2 = this.#h2 + c >>> 0;
            this.#h3 = this.#h3 + d >>> 0;
            this.#h4 = this.#h4 + e >>> 0;
        }
        hex() {
            this.finalize();
            const h0 = this.#h0;
            const h1 = this.#h1;
            const h2 = this.#h2;
            const h3 = this.#h3;
            const h4 = this.#h4;
            return HEX_CHARS[h0 >> 28 & 15] + HEX_CHARS[h0 >> 24 & 15] + HEX_CHARS[h0 >> 20 & 15] + HEX_CHARS[h0 >> 16 & 15] + HEX_CHARS[h0 >> 12 & 15] + HEX_CHARS[h0 >> 8 & 15] + HEX_CHARS[h0 >> 4 & 15] + HEX_CHARS[h0 & 15] + HEX_CHARS[h1 >> 28 & 15] + HEX_CHARS[h1 >> 24 & 15] + HEX_CHARS[h1 >> 20 & 15] + HEX_CHARS[h1 >> 16 & 15] + HEX_CHARS[h1 >> 12 & 15] + HEX_CHARS[h1 >> 8 & 15] + HEX_CHARS[h1 >> 4 & 15] + HEX_CHARS[h1 & 15] + HEX_CHARS[h2 >> 28 & 15] + HEX_CHARS[h2 >> 24 & 15] + HEX_CHARS[h2 >> 20 & 15] + HEX_CHARS[h2 >> 16 & 15] + HEX_CHARS[h2 >> 12 & 15] + HEX_CHARS[h2 >> 8 & 15] + HEX_CHARS[h2 >> 4 & 15] + HEX_CHARS[h2 & 15] + HEX_CHARS[h3 >> 28 & 15] + HEX_CHARS[h3 >> 24 & 15] + HEX_CHARS[h3 >> 20 & 15] + HEX_CHARS[h3 >> 16 & 15] + HEX_CHARS[h3 >> 12 & 15] + HEX_CHARS[h3 >> 8 & 15] + HEX_CHARS[h3 >> 4 & 15] + HEX_CHARS[h3 & 15] + HEX_CHARS[h4 >> 28 & 15] + HEX_CHARS[h4 >> 24 & 15] + HEX_CHARS[h4 >> 20 & 15] + HEX_CHARS[h4 >> 16 & 15] + HEX_CHARS[h4 >> 12 & 15] + HEX_CHARS[h4 >> 8 & 15] + HEX_CHARS[h4 >> 4 & 15] + HEX_CHARS[h4 & 15];
        }
        toString() {
            return this.hex();
        }
        digest() {
            this.finalize();
            const h0 = this.#h0;
            const h1 = this.#h1;
            const h2 = this.#h2;
            const h3 = this.#h3;
            const h4 = this.#h4;
            return [
                h0 >> 24 & 255,
                h0 >> 16 & 255,
                h0 >> 8 & 255,
                h0 & 255,
                h1 >> 24 & 255,
                h1 >> 16 & 255,
                h1 >> 8 & 255,
                h1 & 255,
                h2 >> 24 & 255,
                h2 >> 16 & 255,
                h2 >> 8 & 255,
                h2 & 255,
                h3 >> 24 & 255,
                h3 >> 16 & 255,
                h3 >> 8 & 255,
                h3 & 255,
                h4 >> 24 & 255,
                h4 >> 16 & 255,
                h4 >> 8 & 255,
                h4 & 255, 
            ];
        }
        array() {
            return this.digest();
        }
        arrayBuffer() {
            this.finalize();
            const buffer = new ArrayBuffer(20);
            const dataView = new DataView(buffer);
            dataView.setUint32(0, this.#h0);
            dataView.setUint32(4, this.#h1);
            dataView.setUint32(8, this.#h2);
            dataView.setUint32(12, this.#h3);
            dataView.setUint32(16, this.#h4);
            return buffer;
        }
    }
    class HmacSha1 extends Sha1 {
        #sharedMemory;
        #inner;
        #oKeyPad;
        constructor(secretKey, sharedMemory2 = false){
            super(sharedMemory2);
            let key;
            if (typeof secretKey === "string") {
                const bytes = [];
                const length = secretKey.length;
                let index = 0;
                for(let i = 0; i < length; i++){
                    let code = secretKey.charCodeAt(i);
                    if (code < 128) {
                        bytes[index++] = code;
                    } else if (code < 2048) {
                        bytes[index++] = 192 | code >> 6;
                        bytes[index++] = 128 | code & 63;
                    } else if (code < 55296 || code >= 57344) {
                        bytes[index++] = 224 | code >> 12;
                        bytes[index++] = 128 | code >> 6 & 63;
                        bytes[index++] = 128 | code & 63;
                    } else {
                        code = 65536 + ((code & 1023) << 10 | secretKey.charCodeAt(++i) & 1023);
                        bytes[index++] = 240 | code >> 18;
                        bytes[index++] = 128 | code >> 12 & 63;
                        bytes[index++] = 128 | code >> 6 & 63;
                        bytes[index++] = 128 | code & 63;
                    }
                }
                key = bytes;
            } else {
                if (secretKey instanceof ArrayBuffer) {
                    key = new Uint8Array(secretKey);
                } else {
                    key = secretKey;
                }
            }
            if (key.length > 64) {
                key = new Sha1(true).update(key).array();
            }
            const oKeyPad = [];
            const iKeyPad = [];
            for(let i = 0; i < 64; i++){
                const b = key[i] || 0;
                oKeyPad[i] = 92 ^ b;
                iKeyPad[i] = 54 ^ b;
            }
            this.update(iKeyPad);
            this.#oKeyPad = oKeyPad;
            this.#inner = true;
            this.#sharedMemory = sharedMemory2;
        }
        finalize() {
            super.finalize();
            if (this.#inner) {
                this.#inner = false;
                const innerHash = this.array();
                super.init(this.#sharedMemory);
                this.update(this.#oKeyPad);
                this.update(innerHash);
                super.finalize();
            }
        }
    }
    const Sha11 = Sha1;
    const HmacSha11 = HmacSha1;
    const Sha12 = Sha1;
    class DenoStdInternalError extends Error {
        constructor(message){
            super(message);
            this.name = "DenoStdInternalError";
        }
    }
    function assert(expr, msg = "") {
        if (!expr) {
            throw new DenoStdInternalError(msg);
        }
    }
    const DenoStdInternalError1 = DenoStdInternalError;
    const assert1 = assert;
    const assert2 = assert;
    const mod3 = function() {
        const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
        function validate(id) {
            return UUID_RE.test(id);
        }
        function generate(options, buf, offset) {
            const i1 = buf && offset || 0;
            let { value , namespace  } = options;
            if (typeof value == "string") {
                value = stringToBytes(value);
            }
            if (typeof namespace == "string") {
                namespace = uuidToBytes(namespace);
            }
            assert(namespace.length === 16, "namespace must be uuid string or an Array of 16 byte values");
            const content = namespace.concat(value);
            const bytes = new Sha1().update(createBuffer(content)).digest();
            bytes[6] = bytes[6] & 15 | 80;
            bytes[8] = bytes[8] & 63 | 128;
            if (buf) {
                for(let idx = 0; idx < 16; ++idx){
                    buf[i1 + idx] = bytes[idx];
                }
            }
            return buf || bytesToUuid(bytes);
        }
        return {
            validate,
            generate
        };
    }();
    const v5 = mod3;
    const NIL_UUID = "00000000-0000-0000-0000-000000000000";
    const NIL_UUID1 = NIL_UUID;
    function isNil(val) {
        return val === NIL_UUID;
    }
    const isNil1 = isNil;
    return {
        NIL_UUID,
        isNil,
        v1: mod1,
        v4: mod2,
        v5: mod3
    };
}();
const processActionInput = (input)=>{
    const action = {
        id: input.id || mod.v4.generate(),
        body: input.body,
        context: getContext(input.body),
        title: getTitle(input.body),
        date: getDate(parseDate)(input.body),
        tags: getTags(input.body)
    };
    if (input.done) action.done = today();
    return action;
};
const getActionSaver = (getActions, saveActions1)=>async (input, event)=>{
        const action = processActionInput(input);
        const actions = await getActions(event.request);
        const index = actions.findIndex((a)=>a.id === action.id
        );
        if (~index) {
            actions[index] = action;
        } else {
            actions.push(action);
        }
        console.log("saving", action, actions);
        return saveActions1(actions, event);
    }
;
const renderGroup = (group, headingLevel)=>`\n<h${headingLevel}>${group.heading}</h${headingLevel}>${group.children.length ? `\n  <ul>${group.children.map((item)=>`\n    <li>${renderItem(item, headingLevel + 1)}\n    </li>`
    ).join("")}\n  </ul>` : `\n  🥳\n  <p>No actions here, yay!</p>`}`
;
const renderItem = (item, headingLevel)=>"heading" in item ? renderGroup(item, headingLevel) : renderAction(item)
;
const renderPage = ({ list , autofocus , contexts , tags ,  })=>`\n<!DOCTYPE html>\n<html lang="en">\n\n<head>\n  <meta charset="UTF-8">\n  <meta name="viewport" content="width=device-width, initial-scale=1.0">\n  <title>Humla App - Simple but powerful todo manager</title>\n  <script src="/app.js"></script>\n</head>\n\n<body>\n  <h1>Humla App</h1>\n  <header>\n    <nav>\n      <h2>Dates</h2>\n      <ul>\n        <li><a href="/unprocessed">Unprocessed</a></li>\n        <li><a href="/today">Today</a></li>\n        <li><a href="/week">This Week</a></li>\n        <li><a href="/later">Later</a></li>\n        <li><a href="/someday">Someday</a></li>\n        <li><a href="/all">All</a></li>\n      </ul>\n    </nav>\n  </header>\n  <main>\n    ${renderItem(list, 2)}\n  </main>\n  <aside>\n    <form method="post" action="/actions.json">\n      <h2>Add new action</h2>\n      <p>\n        Add a new action here. Use <code>#tag</code> to add tags and <code>@context</code> to add a context to your\n        actions.\n      </p>\n      <p>\n        New actions will go under <i>Unprocessed</i> unless you set a date for them.\n        Use e.g. <code>!today</code> or <code>!15.12</code> to add dates from here.\n      </p>\n      <textarea name="body" cols="50" rows="5"${autofocus === "add" ? " autofocus" : ""}></textarea>\n      <input type="submit" value="Create"/>\n    </form>\n  </aside>\n  <footer>\n    <nav>\n      <h2>Contexts</h2>${renderLinkList(contexts, `\n      <p>\n        No contexts found<br>\n        Contexts start with an at-sign: <code>@context</code>\n      </p>`)}\n      <h2>Tags</h2>${renderLinkList(tags, `\n      <p>\n        No tags found<br>\n        Tags have the familiar hashtag format: <code>#tag</code>\n      </p>`)}\n    </nav>\n  </footer>\n</body>\n\n</html>\n`
;
const getPageHandler = (getActions)=>async (request)=>{
        const url = new URL(request.url);
        let filter = ()=>true
        ;
        let heading = "Actions";
        const [, section, searchTerm] = url.pathname.split("/");
        const route = routes[section];
        if (route) {
            heading = route.heading;
            if (route.filter) filter = route.filter;
            if (route.searchFilter) filter = route.searchFilter(searchTerm);
        }
        const allActions = await getActions(request);
        const actionGroup = await Promise.resolve(allActions).then(filterActions(filter)).then(groupBy("context"));
        const contexts = linkList("context")(allActions);
        const tags = linkList("tags")(allActions);
        const renderOptions = {
            list: {
                heading,
                children: actionGroup
            },
            contexts,
            tags
        };
        const focus = url.searchParams.get("focus");
        if (focus) {
            renderOptions.autofocus = focus;
        }
        return new Response(renderPage(renderOptions), {
            headers: {
                "Content-Type": "text/html"
            }
        });
    }
;
const getMainHandler = ({ listActions: listActions1 , saveActions: saveActions1 , handleAssetRequest: handleAssetRequest1  })=>{
    const handlePage = getPageHandler(listActions1);
    const handleSave = getSaveHandler(getActionSaver(listActions1, saveActions1));
    return async (event)=>{
        const { request  } = event;
        const url = new URL(request.url);
        if (url.pathname === "/actions.json") {
            if (request.method === "POST") {
                return handleSave(event);
            }
            if (request.method === "GET") {
                return Promise.resolve(request).then(listActions1).then(returnJson);
            }
        }
        if (request.method === "GET") {
            if (url.pathname.includes(".")) return handleAssetRequest1(request);
            return handlePage(request);
        }
        return new Response(undefined, {
            status: 405
        });
    };
};
const handleRequest = getMainHandler({
    listActions,
    saveActions,
    handleAssetRequest
});
self.addEventListener("fetch", (event)=>{
    event.respondWith(handleRequest(event));
});
