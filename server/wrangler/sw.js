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
const filterActions = (filterer)=>(actions)=>{
        return actions.filter(filterer);
    }
;
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
const getMainHandler = ({ handleAsset , handlePage , handleSave , handleRoutes  })=>async (event)=>{
        const { request  } = event;
        const url = new URL(request.url);
        if (handleRoutes && handleRoutes[url.pathname]) {
            return handleRoutes[url.pathname](request);
        }
        if (request.method === "GET" && !url.pathname.includes(".")) {
            return handlePage(request);
        }
        if (request.method === "POST") {
            return handleSave(event);
        }
        return handleAsset(request);
    }
;
const contentTypes = {
    "js": "application/javascript"
};
const getAssetFromKV = async (request)=>{
    if (!ASSETS) {
        return new Response("Need KV binding `ASSETS`", {
            status: 500
        });
    }
    const url = new URL(request.url);
    const contents = await ASSETS.get(url.pathname);
    if (contents === null) {
        return new Response("Not found", {
            status: 404
        });
    }
    let contentType = "text/html";
    const extension = url.pathname.split(".").pop();
    if (extension && contentTypes[extension]) {
        contentType = contentTypes[extension];
    }
    return new Response(contents, {
        headers: {
            "Content-Type": contentType
        }
    });
};
function big_base64(m) {
    if (m === undefined) return undefined;
    const bytes = [];
    while(m > 0n){
        bytes.push(Number(m & 255n));
        m = m >> 8n;
    }
    bytes.reverse();
    let a = btoa(String.fromCharCode.apply(null, bytes)).replace(/=/g, "");
    a = a.replace(/\+/g, "-");
    a = a.replace(/\//g, "_");
    return a;
}
function getHashFunctionName(hash) {
    if (hash === "sha1") return "SHA-1";
    if (hash === "sha256") return "SHA-256";
    return "";
}
async function createWebCryptoKey(key, usage, options) {
    let jwk = {
        kty: "RSA",
        n: big_base64(key.n),
        ext: true
    };
    if (usage === "encrypt") {
        jwk = {
            ...jwk,
            e: big_base64(key.e)
        };
    } else if (usage === "decrypt") {
        jwk = {
            ...jwk,
            d: big_base64(key.d),
            e: big_base64(key.e),
            p: big_base64(key.p),
            q: big_base64(key.q),
            dp: big_base64(key.dp),
            dq: big_base64(key.dq),
            qi: big_base64(key.qi)
        };
    }
    return await crypto.subtle.importKey("jwk", jwk, {
        name: "RSA-OAEP",
        hash: {
            name: getHashFunctionName(options.hash)
        }
    }, false, [
        usage
    ]);
}
class WebCryptoRSA {
    encryptedKey = null;
    decryptedKey = null;
    constructor(key1, options1){
        this.key = key1;
        this.options = options1;
    }
    static isSupported(options) {
        if (!crypto.subtle) return false;
        if (options.padding !== "oaep") return false;
        return true;
    }
    static async encrypt(key, m, options) {
        return await crypto.subtle.encrypt({
            name: "RSA-OAEP"
        }, await createWebCryptoKey(key, "encrypt", options), m);
    }
    static async decrypt(key, m, options) {
        return await crypto.subtle.decrypt({
            name: "RSA-OAEP"
        }, await createWebCryptoKey(key, "decrypt", options), m);
    }
}
function power_mod(n, p, m) {
    if (p === 1n) return n;
    if (p % 2n === 0n) {
        const t = power_mod(n, p >> 1n, m);
        return t * t % m;
    } else {
        const t = power_mod(n, p >> 1n, m);
        return t * t * n % m;
    }
}
function rsaep(n, e, m) {
    return power_mod(m, e, n);
}
function rsadp(key2, c) {
    if (!key2.d) throw "Invalid RSA key";
    if (key2.dp && key2.dq && key2.qi && key2.q && key2.p) {
        const m1 = power_mod(c % key2.p, key2.dp, key2.p);
        const m2 = power_mod(c % key2.q, key2.dq, key2.q);
        let h = 0n;
        if (m1 >= m2) {
            h = key2.qi * (m1 - m2) % key2.p;
        } else {
            h = key2.qi * (m1 - m2 + key2.p * (key2.p / key2.q)) % key2.p;
        }
        return (m2 + h * key2.q) % (key2.q * key2.p);
    } else {
        return power_mod(c, key2.d, key2.n);
    }
}
function detect_format(key2) {
    if (typeof key2 === "object") {
        if (key2.kty === "RSA") return "jwk";
    } else if (typeof key2 === "string") {
        if (key2.substr(0, "-----".length) === "-----") return "pem";
    }
    throw new TypeError("Unsupported key format");
}
function createSizeBuffer(size) {
    if (size <= 127) return new Uint8Array([
        size
    ]);
    const bytes = [];
    while(size > 0){
        bytes.push(size & 255);
        size = size >> 8;
    }
    bytes.reverse();
    return new Uint8Array([
        128 + bytes.length,
        ...bytes
    ]);
}
class BER {
    static createSequence(children) {
        const size = children.reduce((accumlatedSize, child)=>accumlatedSize + child.length
        , 0);
        return new Uint8Array([
            48,
            ...createSizeBuffer(size),
            ...children.reduce((buffer, child)=>[
                    ...buffer,
                    ...child
                ]
            , []), 
        ]);
    }
    static createNull() {
        return new Uint8Array([
            5,
            0
        ]);
    }
    static createBoolean(value) {
        return new Uint8Array([
            1,
            1,
            value ? 1 : 0
        ]);
    }
    static createInteger(value) {
        if (typeof value === "number") return BER.createBigInteger(BigInt(value));
        return BER.createBigInteger(value);
    }
    static createBigInteger(value) {
        if (value === 0n) return new Uint8Array([
            2,
            1,
            0
        ]);
        const isNegative = value < 0;
        const content = [];
        let n = isNegative ? -value : value;
        while(n > 0n){
            content.push(Number(n & 255n));
            n = n >> 8n;
        }
        if (!isNegative) {
            if (content[content.length - 1] & 128) content.push(0);
        } else {
            for(let i = 0; i < content.length; i++)content[i] = 256 - content[i];
            if (!(content[content.length - 1] & 128)) content.push(255);
        }
        content.reverse();
        return new Uint8Array([
            2,
            ...createSizeBuffer(content.length),
            ...content, 
        ]);
    }
    static createBitString(value) {
        return new Uint8Array([
            3,
            ...createSizeBuffer(value.length + 1),
            0,
            ...value, 
        ]);
    }
}
function add_line_break(base64_str) {
    const lines = [];
    for(let i = 0; i < base64_str.length; i += 64){
        lines.push(base64_str.substr(i, 64));
    }
    return lines.join("\n");
}
function computeMessage(m) {
    return typeof m === "string" ? new TextEncoder().encode(m) : m;
}
function computeOption(options2) {
    return {
        hash: "sha1",
        padding: "oaep",
        ...options2
    };
}
function base64(m) {
    return btoa(String.fromCharCode.apply(null, [
        ...m
    ])).replace(/=/g, "");
}
class WebCryptoAES {
    wkey = null;
    constructor(key2, config1){
        this.key = key2;
        this.config = config1;
    }
    async loadKey() {
        if (this.wkey === null) {
            this.wkey = await crypto.subtle.importKey("jwk", {
                kty: "oct",
                k: base64(this.key)
            }, "AES-CBC", true, [
                "encrypt",
                "decrypt"
            ]);
        }
        return this.wkey;
    }
    async encrypt(m) {
        const key3 = await this.loadKey();
        const option = {
            name: "AES-CBC",
            iv: this.config.iv
        };
        const data = await crypto.subtle.encrypt(option, key3, m);
        return new Uint8Array(data);
    }
    async decrypt(m) {
        const key3 = await this.loadKey();
        const option = {
            name: "AES-CBC",
            iv: this.config.iv
        };
        const data = await crypto.subtle.decrypt(option, key3, m);
        return new Uint8Array(data);
    }
}
class ECB {
    static encrypt(m, ciper, blockSize) {
        if (m.length % blockSize !== 0) throw "Message is not properly padded";
        const output = new Uint8Array(m.length);
        for(let i = 0; i < m.length; i += blockSize){
            output.set(ciper.encrypt(m.slice(i, i + blockSize)), i);
        }
        return output;
    }
    static decrypt(m, ciper, blockSize) {
        if (m.length % blockSize !== 0) throw "Message is not properly padded";
        const output = new Uint8Array(m.length);
        for(let i = 0; i < m.length; i += blockSize){
            output.set(ciper.decrypt(m.slice(i, i + blockSize)), i);
        }
        return output;
    }
}
function pad(m) {
    const blockNumber = Math.ceil((m.length + 1) / 16);
    const paddedMessageLength = blockNumber * 16;
    const remainedLength = paddedMessageLength - m.length;
    const paddedMessage = new Uint8Array(paddedMessageLength);
    paddedMessage.set(m, 0);
    paddedMessage.set(new Array(remainedLength).fill(remainedLength), m.length);
    return paddedMessage;
}
function unpad(m) {
    const lastByte = m[m.length - 1];
    return new Uint8Array(m.slice(0, m.length - lastByte));
}
const SBOX = [
    99,
    124,
    119,
    123,
    242,
    107,
    111,
    197,
    48,
    1,
    103,
    43,
    254,
    215,
    171,
    118,
    202,
    130,
    201,
    125,
    250,
    89,
    71,
    240,
    173,
    212,
    162,
    175,
    156,
    164,
    114,
    192,
    183,
    253,
    147,
    38,
    54,
    63,
    247,
    204,
    52,
    165,
    229,
    241,
    113,
    216,
    49,
    21,
    4,
    199,
    35,
    195,
    24,
    150,
    5,
    154,
    7,
    18,
    128,
    226,
    235,
    39,
    178,
    117,
    9,
    131,
    44,
    26,
    27,
    110,
    90,
    160,
    82,
    59,
    214,
    179,
    41,
    227,
    47,
    132,
    83,
    209,
    0,
    237,
    32,
    252,
    177,
    91,
    106,
    203,
    190,
    57,
    74,
    76,
    88,
    207,
    208,
    239,
    170,
    251,
    67,
    77,
    51,
    133,
    69,
    249,
    2,
    127,
    80,
    60,
    159,
    168,
    81,
    163,
    64,
    143,
    146,
    157,
    56,
    245,
    188,
    182,
    218,
    33,
    16,
    255,
    243,
    210,
    205,
    12,
    19,
    236,
    95,
    151,
    68,
    23,
    196,
    167,
    126,
    61,
    100,
    93,
    25,
    115,
    96,
    129,
    79,
    220,
    34,
    42,
    144,
    136,
    70,
    238,
    184,
    20,
    222,
    94,
    11,
    219,
    224,
    50,
    58,
    10,
    73,
    6,
    36,
    92,
    194,
    211,
    172,
    98,
    145,
    149,
    228,
    121,
    231,
    200,
    55,
    109,
    141,
    213,
    78,
    169,
    108,
    86,
    244,
    234,
    101,
    122,
    174,
    8,
    186,
    120,
    37,
    46,
    28,
    166,
    180,
    198,
    232,
    221,
    116,
    31,
    75,
    189,
    139,
    138,
    112,
    62,
    181,
    102,
    72,
    3,
    246,
    14,
    97,
    53,
    87,
    185,
    134,
    193,
    29,
    158,
    225,
    248,
    152,
    17,
    105,
    217,
    142,
    148,
    155,
    30,
    135,
    233,
    206,
    85,
    40,
    223,
    140,
    161,
    137,
    13,
    191,
    230,
    66,
    104,
    65,
    153,
    45,
    15,
    176,
    84,
    187,
    22, 
];
const INV_SBOX = [
    82,
    9,
    106,
    213,
    48,
    54,
    165,
    56,
    191,
    64,
    163,
    158,
    129,
    243,
    215,
    251,
    124,
    227,
    57,
    130,
    155,
    47,
    255,
    135,
    52,
    142,
    67,
    68,
    196,
    222,
    233,
    203,
    84,
    123,
    148,
    50,
    166,
    194,
    35,
    61,
    238,
    76,
    149,
    11,
    66,
    250,
    195,
    78,
    8,
    46,
    161,
    102,
    40,
    217,
    36,
    178,
    118,
    91,
    162,
    73,
    109,
    139,
    209,
    37,
    114,
    248,
    246,
    100,
    134,
    104,
    152,
    22,
    212,
    164,
    92,
    204,
    93,
    101,
    182,
    146,
    108,
    112,
    72,
    80,
    253,
    237,
    185,
    218,
    94,
    21,
    70,
    87,
    167,
    141,
    157,
    132,
    144,
    216,
    171,
    0,
    140,
    188,
    211,
    10,
    247,
    228,
    88,
    5,
    184,
    179,
    69,
    6,
    208,
    44,
    30,
    143,
    202,
    63,
    15,
    2,
    193,
    175,
    189,
    3,
    1,
    19,
    138,
    107,
    58,
    145,
    17,
    65,
    79,
    103,
    220,
    234,
    151,
    242,
    207,
    206,
    240,
    180,
    230,
    115,
    150,
    172,
    116,
    34,
    231,
    173,
    53,
    133,
    226,
    249,
    55,
    232,
    28,
    117,
    223,
    110,
    71,
    241,
    26,
    113,
    29,
    41,
    197,
    137,
    111,
    183,
    98,
    14,
    170,
    24,
    190,
    27,
    252,
    86,
    62,
    75,
    198,
    210,
    121,
    32,
    154,
    219,
    192,
    254,
    120,
    205,
    90,
    244,
    31,
    221,
    168,
    51,
    136,
    7,
    199,
    49,
    177,
    18,
    16,
    89,
    39,
    128,
    236,
    95,
    96,
    81,
    127,
    169,
    25,
    181,
    74,
    13,
    45,
    229,
    122,
    159,
    147,
    201,
    156,
    239,
    160,
    224,
    59,
    77,
    174,
    42,
    245,
    176,
    200,
    235,
    187,
    60,
    131,
    83,
    153,
    97,
    23,
    43,
    4,
    126,
    186,
    119,
    214,
    38,
    225,
    105,
    20,
    99,
    85,
    33,
    12,
    125, 
];
const RCON = [
    0,
    1,
    2,
    4,
    8,
    16,
    32,
    64,
    128,
    27,
    54
];
function xtime(n, x) {
    if (x === 1) return n;
    let output = 0;
    let multiply = n;
    while(x > 0){
        if (x & 1) output ^= multiply;
        multiply = multiply & 128 ? multiply << 1 ^ 283 : multiply << 1;
        x = x >> 1;
    }
    return output & 255;
}
function rotWord(keySchedule, column) {
    const offset = column * 4;
    const tmp = keySchedule[offset];
    keySchedule[offset] = keySchedule[offset + 1];
    keySchedule[offset + 1] = keySchedule[offset + 2];
    keySchedule[offset + 2] = keySchedule[offset + 3];
    keySchedule[offset + 3] = tmp;
}
function subWord(keySchedule, column) {
    const offset = column * 4;
    for(let i = 0; i < 4; i++){
        keySchedule[offset + i] = SBOX[keySchedule[offset + i]];
    }
}
function keyExpansion(key3) {
    const Nb = 4;
    const Nk = key3.length / 4;
    const Nr = Nk + 6;
    const keySchedule = new Uint8Array(16 * (Nr + 1));
    keySchedule.set(key3, 0);
    for(let i = Nk; i < 4 * (Nr + 1); i++){
        const prevOffset = (i - Nk) * 4;
        const offset = i * 4;
        keySchedule[offset] = keySchedule[offset - 4];
        keySchedule[offset + 1] = keySchedule[offset - 3];
        keySchedule[offset + 2] = keySchedule[offset - 2];
        keySchedule[offset + 3] = keySchedule[offset - 1];
        if (i % Nk === 0) {
            rotWord(keySchedule, i);
            subWord(keySchedule, i);
            keySchedule[offset] ^= RCON[i / Nk];
        } else if (Nk > 6 && i % Nk === 4) {
            subWord(keySchedule, i);
        }
        keySchedule[offset] ^= keySchedule[prevOffset];
        keySchedule[offset + 1] ^= keySchedule[prevOffset + 1];
        keySchedule[offset + 2] ^= keySchedule[prevOffset + 2];
        keySchedule[offset + 3] ^= keySchedule[prevOffset + 3];
    }
    return keySchedule;
}
class AESBlockCiper {
    constructor(key3){
        this.keySchedule = keyExpansion(key3);
    }
    subBytes(block) {
        for(let i = 0; i < block.length; i++){
            block[i] = SBOX[block[i]];
        }
    }
    inverseSubBytes(block) {
        for(let i = 0; i < block.length; i++){
            block[i] = INV_SBOX[block[i]];
        }
    }
    shiftRow(block) {
        let t = block[1];
        block[1] = block[5];
        block[5] = block[9];
        block[9] = block[13];
        block[13] = t;
        t = block[10];
        block[10] = block[2];
        block[2] = t;
        t = block[14];
        block[14] = block[6];
        block[6] = t;
        t = block[15];
        block[15] = block[11];
        block[11] = block[7];
        block[7] = block[3];
        block[3] = t;
    }
    inverseShiftRow(block) {
        let t = block[13];
        block[13] = block[9];
        block[9] = block[5];
        block[5] = block[1];
        block[1] = t;
        t = block[10];
        block[10] = block[2];
        block[2] = t;
        t = block[14];
        block[14] = block[6];
        block[6] = t;
        t = block[3];
        block[3] = block[7];
        block[7] = block[11];
        block[11] = block[15];
        block[15] = t;
    }
    addRoundKey(state, round) {
        for(let i = 0; i < 16; i++){
            state[i] ^= this.keySchedule[round * 16 + i];
        }
    }
    mixColumn(block) {
        for(let i = 0; i < 4; i++){
            const offset = i * 4;
            const a = [
                block[offset],
                block[offset + 1],
                block[offset + 2],
                block[offset + 3], 
            ];
            block[offset] = xtime(a[0], 2) ^ xtime(a[1], 3) ^ xtime(a[2], 1) ^ xtime(a[3], 1);
            block[offset + 1] = xtime(a[0], 1) ^ xtime(a[1], 2) ^ xtime(a[2], 3) ^ xtime(a[3], 1);
            block[offset + 2] = xtime(a[0], 1) ^ xtime(a[1], 1) ^ xtime(a[2], 2) ^ xtime(a[3], 3);
            block[offset + 3] = xtime(a[0], 3) ^ xtime(a[1], 1) ^ xtime(a[2], 1) ^ xtime(a[3], 2);
        }
    }
    inverseMixColumn(block) {
        for(let i = 0; i < 4; i++){
            const offset = i * 4;
            const a = [
                block[offset],
                block[offset + 1],
                block[offset + 2],
                block[offset + 3], 
            ];
            block[offset] = xtime(a[0], 14) ^ xtime(a[1], 11) ^ xtime(a[2], 13) ^ xtime(a[3], 9);
            block[offset + 1] = xtime(a[0], 9) ^ xtime(a[1], 14) ^ xtime(a[2], 11) ^ xtime(a[3], 13);
            block[offset + 2] = xtime(a[0], 13) ^ xtime(a[1], 9) ^ xtime(a[2], 14) ^ xtime(a[3], 11);
            block[offset + 3] = xtime(a[0], 11) ^ xtime(a[1], 13) ^ xtime(a[2], 9) ^ xtime(a[3], 14);
        }
    }
    encrypt(m) {
        const nb = 4;
        const nr = this.keySchedule.length / 16 - 1;
        const state = new Uint8Array(m);
        this.addRoundKey(state, 0);
        for(let i = 1; i < nr; i++){
            this.subBytes(state);
            this.shiftRow(state);
            this.mixColumn(state);
            this.addRoundKey(state, i);
        }
        this.subBytes(state);
        this.shiftRow(state);
        this.addRoundKey(state, nr);
        return state;
    }
    decrypt(m) {
        const nb = 4;
        const nr = this.keySchedule.length / 16 - 1;
        const state = new Uint8Array(m);
        this.addRoundKey(state, nr);
        for(let i = nr - 1; i > 0; i--){
            this.inverseShiftRow(state);
            this.inverseSubBytes(state);
            this.addRoundKey(state, i);
            this.inverseMixColumn(state);
        }
        this.inverseShiftRow(state);
        this.inverseSubBytes(state);
        this.addRoundKey(state, 0);
        return state;
    }
}
function computeMessage1(m) {
    return typeof m === "string" ? new TextEncoder().encode(m) : m;
}
function numberToByte(n) {
    const a = new Uint8Array(8);
    for(let i = 7; i >= 0; i--){
        a[i] = n & 255;
        n = n >> 8;
    }
    return a;
}
function dt(h, digits) {
    let offset = h[h.length - 1] & 15;
    const a = h.slice(offset, offset + 4);
    const code = ((a[0] & 127) << 24) + ((a[1] & 255) << 16) + ((a[2] & 255) << 8) + (a[3] & 255);
    return code % Math.pow(10, digits);
}
const mod = function() {
    const base64abc = [
        "A",
        "B",
        "C",
        "D",
        "E",
        "F",
        "G",
        "H",
        "I",
        "J",
        "K",
        "L",
        "M",
        "N",
        "O",
        "P",
        "Q",
        "R",
        "S",
        "T",
        "U",
        "V",
        "W",
        "X",
        "Y",
        "Z",
        "a",
        "b",
        "c",
        "d",
        "e",
        "f",
        "g",
        "h",
        "i",
        "j",
        "k",
        "l",
        "m",
        "n",
        "o",
        "p",
        "q",
        "r",
        "s",
        "t",
        "u",
        "v",
        "w",
        "x",
        "y",
        "z",
        "0",
        "1",
        "2",
        "3",
        "4",
        "5",
        "6",
        "7",
        "8",
        "9",
        "+",
        "/"
    ];
    function encode(data) {
        const uint8 = typeof data === "string" ? new TextEncoder().encode(data) : data instanceof Uint8Array ? data : new Uint8Array(data);
        let result = "", i;
        const l = uint8.length;
        for(i = 2; i < l; i += 3){
            result += base64abc[uint8[i - 2] >> 2];
            result += base64abc[(uint8[i - 2] & 3) << 4 | uint8[i - 1] >> 4];
            result += base64abc[(uint8[i - 1] & 15) << 2 | uint8[i] >> 6];
            result += base64abc[uint8[i] & 63];
        }
        if (i === l + 1) {
            result += base64abc[uint8[i - 2] >> 2];
            result += base64abc[(uint8[i - 2] & 3) << 4];
            result += "==";
        }
        if (i === l) {
            result += base64abc[uint8[i - 2] >> 2];
            result += base64abc[(uint8[i - 2] & 3) << 4 | uint8[i - 1] >> 4];
            result += base64abc[(uint8[i - 1] & 15) << 2];
            result += "=";
        }
        return result;
    }
    function decode(b64) {
        const binString = atob(b64);
        const size = binString.length;
        const bytes = new Uint8Array(size);
        for(let i = 0; i < size; i++){
            bytes[i] = binString.charCodeAt(i);
        }
        return bytes;
    }
    const encode1 = encode;
    const decode1 = decode;
    function addPaddingToBase64url(base64url) {
        if (base64url.length % 4 === 2) return base64url + "==";
        if (base64url.length % 4 === 3) return base64url + "=";
        if (base64url.length % 4 === 1) {
            throw new TypeError("Illegal base64url string!");
        }
        return base64url;
    }
    const addPaddingToBase64url1 = addPaddingToBase64url;
    function convertBase64urlToBase64(b64url) {
        return addPaddingToBase64url(b64url).replace(/\-/g, "+").replace(/_/g, "/");
    }
    function convertBase64ToBase64url(b64) {
        return b64.replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
    }
    function encode2(uint8) {
        return convertBase64ToBase64url(encode(uint8));
    }
    const encode3 = encode2;
    function decode2(b64url) {
        return decode(convertBase64urlToBase64(b64url));
    }
    const decode3 = decode2;
    return {
        addPaddingToBase64url,
        encode: encode2,
        decode: decode2
    };
}();
const hextable = new TextEncoder().encode("0123456789abcdef");
function fromHexChar(byte) {
    if (48 <= byte && byte <= 57) return byte - 48;
    if (97 <= byte && byte <= 102) return byte - 97 + 10;
    if (65 <= byte && byte <= 70) return byte - 65 + 10;
    throw errInvalidByte(byte);
}
function encodedLen(n) {
    return n * 2;
}
function encode(src) {
    const dst = new Uint8Array(encodedLen(src.length));
    for(let i = 0; i < dst.length; i++){
        const v = src[i];
        dst[i * 2] = hextable[v >> 4];
        dst[i * 2 + 1] = hextable[v & 15];
    }
    return dst;
}
function encodeToString(src) {
    return new TextDecoder().decode(encode(src));
}
function decodedLen(x) {
    return x >>> 1;
}
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
const K = [
    1116352408,
    1899447441,
    3049323471,
    3921009573,
    961987163,
    1508970993,
    2453635748,
    2870763221,
    3624381080,
    310598401,
    607225278,
    1426881987,
    1925078388,
    2162078206,
    2614888103,
    3248222580,
    3835390401,
    4022224774,
    264347078,
    604807628,
    770255983,
    1249150122,
    1555081692,
    1996064986,
    2554220882,
    2821834349,
    2952996808,
    3210313671,
    3336571891,
    3584528711,
    113926993,
    338241895,
    666307205,
    773529912,
    1294757372,
    1396182291,
    1695183700,
    1986661051,
    2177026350,
    2456956037,
    2730485921,
    2820302411,
    3259730800,
    3345764771,
    3516065817,
    3600352804,
    4094571909,
    275423344,
    430227734,
    506948616,
    659060556,
    883997877,
    958139571,
    1322822218,
    1537002063,
    1747873779,
    1955562222,
    2024104815,
    2227730452,
    2361852424,
    2428436474,
    2756734187,
    3204031479,
    3329325298, 
];
const blocks = [];
class Sha256 {
    #block;
    #blocks;
    #bytes;
    #finalized;
    #first;
    #h0;
    #h1;
    #h2;
    #h3;
    #h4;
    #h5;
    #h6;
    #h7;
    #hashed;
    #hBytes;
    #is224;
    #lastByteIndex=0;
    #start;
    constructor(is2241 = false, sharedMemory1 = false){
        this.init(is2241, sharedMemory1);
    }
    init(is224, sharedMemory) {
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
        if (is224) {
            this.#h0 = 3238371032;
            this.#h1 = 914150663;
            this.#h2 = 812702999;
            this.#h3 = 4144912697;
            this.#h4 = 4290775857;
            this.#h5 = 1750603025;
            this.#h6 = 1694076839;
            this.#h7 = 3204075428;
        } else {
            this.#h0 = 1779033703;
            this.#h1 = 3144134277;
            this.#h2 = 1013904242;
            this.#h3 = 2773480762;
            this.#h4 = 1359893119;
            this.#h5 = 2600822924;
            this.#h6 = 528734635;
            this.#h7 = 1541459225;
        }
        this.#block = this.#start = this.#bytes = this.#hBytes = 0;
        this.#finalized = this.#hashed = false;
        this.#first = true;
        this.#is224 = is224;
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
            this.#hBytes += this.#bytes / 4294967296 << 0;
            this.#bytes = this.#bytes % 4294967296;
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
        let f = this.#h5;
        let g = this.#h6;
        let h = this.#h7;
        const blocks1 = this.#blocks;
        let s0;
        let s1;
        let maj;
        let t1;
        let t2;
        let ch;
        let ab;
        let da;
        let cd;
        let bc;
        for(let j = 16; j < 64; ++j){
            t1 = blocks1[j - 15];
            s0 = (t1 >>> 7 | t1 << 25) ^ (t1 >>> 18 | t1 << 14) ^ t1 >>> 3;
            t1 = blocks1[j - 2];
            s1 = (t1 >>> 17 | t1 << 15) ^ (t1 >>> 19 | t1 << 13) ^ t1 >>> 10;
            blocks1[j] = blocks1[j - 16] + s0 + blocks1[j - 7] + s1 << 0;
        }
        bc = b & c;
        for(let j1 = 0; j1 < 64; j1 += 4){
            if (this.#first) {
                if (this.#is224) {
                    ab = 300032;
                    t1 = blocks1[0] - 1413257819;
                    h = t1 - 150054599 << 0;
                    d = t1 + 24177077 << 0;
                } else {
                    ab = 704751109;
                    t1 = blocks1[0] - 210244248;
                    h = t1 - 1521486534 << 0;
                    d = t1 + 143694565 << 0;
                }
                this.#first = false;
            } else {
                s0 = (a >>> 2 | a << 30) ^ (a >>> 13 | a << 19) ^ (a >>> 22 | a << 10);
                s1 = (e >>> 6 | e << 26) ^ (e >>> 11 | e << 21) ^ (e >>> 25 | e << 7);
                ab = a & b;
                maj = ab ^ a & c ^ bc;
                ch = e & f ^ ~e & g;
                t1 = h + s1 + ch + K[j1] + blocks1[j1];
                t2 = s0 + maj;
                h = d + t1 << 0;
                d = t1 + t2 << 0;
            }
            s0 = (d >>> 2 | d << 30) ^ (d >>> 13 | d << 19) ^ (d >>> 22 | d << 10);
            s1 = (h >>> 6 | h << 26) ^ (h >>> 11 | h << 21) ^ (h >>> 25 | h << 7);
            da = d & a;
            maj = da ^ d & b ^ ab;
            ch = h & e ^ ~h & f;
            t1 = g + s1 + ch + K[j1 + 1] + blocks1[j1 + 1];
            t2 = s0 + maj;
            g = c + t1 << 0;
            c = t1 + t2 << 0;
            s0 = (c >>> 2 | c << 30) ^ (c >>> 13 | c << 19) ^ (c >>> 22 | c << 10);
            s1 = (g >>> 6 | g << 26) ^ (g >>> 11 | g << 21) ^ (g >>> 25 | g << 7);
            cd = c & d;
            maj = cd ^ c & a ^ da;
            ch = g & h ^ ~g & e;
            t1 = f + s1 + ch + K[j1 + 2] + blocks1[j1 + 2];
            t2 = s0 + maj;
            f = b + t1 << 0;
            b = t1 + t2 << 0;
            s0 = (b >>> 2 | b << 30) ^ (b >>> 13 | b << 19) ^ (b >>> 22 | b << 10);
            s1 = (f >>> 6 | f << 26) ^ (f >>> 11 | f << 21) ^ (f >>> 25 | f << 7);
            bc = b & c;
            maj = bc ^ b & d ^ cd;
            ch = f & g ^ ~f & h;
            t1 = e + s1 + ch + K[j1 + 3] + blocks1[j1 + 3];
            t2 = s0 + maj;
            e = a + t1 << 0;
            a = t1 + t2 << 0;
        }
        this.#h0 = this.#h0 + a << 0;
        this.#h1 = this.#h1 + b << 0;
        this.#h2 = this.#h2 + c << 0;
        this.#h3 = this.#h3 + d << 0;
        this.#h4 = this.#h4 + e << 0;
        this.#h5 = this.#h5 + f << 0;
        this.#h6 = this.#h6 + g << 0;
        this.#h7 = this.#h7 + h << 0;
    }
    hex() {
        this.finalize();
        const h0 = this.#h0;
        const h1 = this.#h1;
        const h2 = this.#h2;
        const h3 = this.#h3;
        const h4 = this.#h4;
        const h5 = this.#h5;
        const h6 = this.#h6;
        const h7 = this.#h7;
        let hex = HEX_CHARS[h0 >> 28 & 15] + HEX_CHARS[h0 >> 24 & 15] + HEX_CHARS[h0 >> 20 & 15] + HEX_CHARS[h0 >> 16 & 15] + HEX_CHARS[h0 >> 12 & 15] + HEX_CHARS[h0 >> 8 & 15] + HEX_CHARS[h0 >> 4 & 15] + HEX_CHARS[h0 & 15] + HEX_CHARS[h1 >> 28 & 15] + HEX_CHARS[h1 >> 24 & 15] + HEX_CHARS[h1 >> 20 & 15] + HEX_CHARS[h1 >> 16 & 15] + HEX_CHARS[h1 >> 12 & 15] + HEX_CHARS[h1 >> 8 & 15] + HEX_CHARS[h1 >> 4 & 15] + HEX_CHARS[h1 & 15] + HEX_CHARS[h2 >> 28 & 15] + HEX_CHARS[h2 >> 24 & 15] + HEX_CHARS[h2 >> 20 & 15] + HEX_CHARS[h2 >> 16 & 15] + HEX_CHARS[h2 >> 12 & 15] + HEX_CHARS[h2 >> 8 & 15] + HEX_CHARS[h2 >> 4 & 15] + HEX_CHARS[h2 & 15] + HEX_CHARS[h3 >> 28 & 15] + HEX_CHARS[h3 >> 24 & 15] + HEX_CHARS[h3 >> 20 & 15] + HEX_CHARS[h3 >> 16 & 15] + HEX_CHARS[h3 >> 12 & 15] + HEX_CHARS[h3 >> 8 & 15] + HEX_CHARS[h3 >> 4 & 15] + HEX_CHARS[h3 & 15] + HEX_CHARS[h4 >> 28 & 15] + HEX_CHARS[h4 >> 24 & 15] + HEX_CHARS[h4 >> 20 & 15] + HEX_CHARS[h4 >> 16 & 15] + HEX_CHARS[h4 >> 12 & 15] + HEX_CHARS[h4 >> 8 & 15] + HEX_CHARS[h4 >> 4 & 15] + HEX_CHARS[h4 & 15] + HEX_CHARS[h5 >> 28 & 15] + HEX_CHARS[h5 >> 24 & 15] + HEX_CHARS[h5 >> 20 & 15] + HEX_CHARS[h5 >> 16 & 15] + HEX_CHARS[h5 >> 12 & 15] + HEX_CHARS[h5 >> 8 & 15] + HEX_CHARS[h5 >> 4 & 15] + HEX_CHARS[h5 & 15] + HEX_CHARS[h6 >> 28 & 15] + HEX_CHARS[h6 >> 24 & 15] + HEX_CHARS[h6 >> 20 & 15] + HEX_CHARS[h6 >> 16 & 15] + HEX_CHARS[h6 >> 12 & 15] + HEX_CHARS[h6 >> 8 & 15] + HEX_CHARS[h6 >> 4 & 15] + HEX_CHARS[h6 & 15];
        if (!this.#is224) {
            hex += HEX_CHARS[h7 >> 28 & 15] + HEX_CHARS[h7 >> 24 & 15] + HEX_CHARS[h7 >> 20 & 15] + HEX_CHARS[h7 >> 16 & 15] + HEX_CHARS[h7 >> 12 & 15] + HEX_CHARS[h7 >> 8 & 15] + HEX_CHARS[h7 >> 4 & 15] + HEX_CHARS[h7 & 15];
        }
        return hex;
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
        const h5 = this.#h5;
        const h6 = this.#h6;
        const h7 = this.#h7;
        const arr = [
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
            h5 >> 24 & 255,
            h5 >> 16 & 255,
            h5 >> 8 & 255,
            h5 & 255,
            h6 >> 24 & 255,
            h6 >> 16 & 255,
            h6 >> 8 & 255,
            h6 & 255, 
        ];
        if (!this.#is224) {
            arr.push(h7 >> 24 & 255, h7 >> 16 & 255, h7 >> 8 & 255, h7 & 255);
        }
        return arr;
    }
    array() {
        return this.digest();
    }
    arrayBuffer() {
        this.finalize();
        const buffer = new ArrayBuffer(this.#is224 ? 28 : 32);
        const dataView = new DataView(buffer);
        dataView.setUint32(0, this.#h0);
        dataView.setUint32(4, this.#h1);
        dataView.setUint32(8, this.#h2);
        dataView.setUint32(12, this.#h3);
        dataView.setUint32(16, this.#h4);
        dataView.setUint32(20, this.#h5);
        dataView.setUint32(24, this.#h6);
        if (!this.#is224) {
            dataView.setUint32(28, this.#h7);
        }
        return buffer;
    }
}
class HmacSha256 extends Sha256 {
    #inner;
    #is224;
    #oKeyPad;
    #sharedMemory;
    constructor(secretKey, is2242 = false, sharedMemory2 = false){
        super(is2242, sharedMemory2);
        let key4;
        if (typeof secretKey === "string") {
            const bytes = [];
            const length = secretKey.length;
            let index = 0;
            for(let i = 0; i < length; ++i){
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
            key4 = bytes;
        } else {
            if (secretKey instanceof ArrayBuffer) {
                key4 = new Uint8Array(secretKey);
            } else {
                key4 = secretKey;
            }
        }
        if (key4.length > 64) {
            key4 = new Sha256(is2242, true).update(key4).array();
        }
        const oKeyPad = [];
        const iKeyPad = [];
        for(let i = 0; i < 64; ++i){
            const b = key4[i] || 0;
            oKeyPad[i] = 92 ^ b;
            iKeyPad[i] = 54 ^ b;
        }
        this.update(iKeyPad);
        this.#oKeyPad = oKeyPad;
        this.#inner = true;
        this.#is224 = is2242;
        this.#sharedMemory = sharedMemory2;
    }
    finalize() {
        super.finalize();
        if (this.#inner) {
            this.#inner = false;
            const innerHash = this.array();
            super.init(this.#is224, this.#sharedMemory);
            this.update(this.#oKeyPad);
            this.update(innerHash);
            super.finalize();
        }
    }
}
const HEX_CHARS1 = [
    "0",
    "1",
    "2",
    "3",
    "4",
    "5",
    "6",
    "7",
    "8",
    "9",
    "a",
    "b",
    "c",
    "d",
    "e",
    "f"
];
const EXTRA1 = [
    -2147483648,
    8388608,
    32768,
    128
];
const SHIFT1 = [
    24,
    16,
    8,
    0
];
const K1 = [
    1116352408,
    3609767458,
    1899447441,
    602891725,
    3049323471,
    3964484399,
    3921009573,
    2173295548,
    961987163,
    4081628472,
    1508970993,
    3053834265,
    2453635748,
    2937671579,
    2870763221,
    3664609560,
    3624381080,
    2734883394,
    310598401,
    1164996542,
    607225278,
    1323610764,
    1426881987,
    3590304994,
    1925078388,
    4068182383,
    2162078206,
    991336113,
    2614888103,
    633803317,
    3248222580,
    3479774868,
    3835390401,
    2666613458,
    4022224774,
    944711139,
    264347078,
    2341262773,
    604807628,
    2007800933,
    770255983,
    1495990901,
    1249150122,
    1856431235,
    1555081692,
    3175218132,
    1996064986,
    2198950837,
    2554220882,
    3999719339,
    2821834349,
    766784016,
    2952996808,
    2566594879,
    3210313671,
    3203337956,
    3336571891,
    1034457026,
    3584528711,
    2466948901,
    113926993,
    3758326383,
    338241895,
    168717936,
    666307205,
    1188179964,
    773529912,
    1546045734,
    1294757372,
    1522805485,
    1396182291,
    2643833823,
    1695183700,
    2343527390,
    1986661051,
    1014477480,
    2177026350,
    1206759142,
    2456956037,
    344077627,
    2730485921,
    1290863460,
    2820302411,
    3158454273,
    3259730800,
    3505952657,
    3345764771,
    106217008,
    3516065817,
    3606008344,
    3600352804,
    1432725776,
    4094571909,
    1467031594,
    275423344,
    851169720,
    430227734,
    3100823752,
    506948616,
    1363258195,
    659060556,
    3750685593,
    883997877,
    3785050280,
    958139571,
    3318307427,
    1322822218,
    3812723403,
    1537002063,
    2003034995,
    1747873779,
    3602036899,
    1955562222,
    1575990012,
    2024104815,
    1125592928,
    2227730452,
    2716904306,
    2361852424,
    442776044,
    2428436474,
    593698344,
    2756734187,
    3733110249,
    3204031479,
    2999351573,
    3329325298,
    3815920427,
    3391569614,
    3928383900,
    3515267271,
    566280711,
    3940187606,
    3454069534,
    4118630271,
    4000239992,
    116418474,
    1914138554,
    174292421,
    2731055270,
    289380356,
    3203993006,
    460393269,
    320620315,
    685471733,
    587496836,
    852142971,
    1086792851,
    1017036298,
    365543100,
    1126000580,
    2618297676,
    1288033470,
    3409855158,
    1501505948,
    4234509866,
    1607167915,
    987167468,
    1816402316,
    1246189591
];
const blocks1 = [];
class Sha512 {
    #blocks;
    #block;
    #bits;
    #start;
    #bytes;
    #hBytes;
    #lastByteIndex=0;
    #finalized;
    #hashed;
    #h0h;
    #h0l;
    #h1h;
    #h1l;
    #h2h;
    #h2l;
    #h3h;
    #h3l;
    #h4h;
    #h4l;
    #h5h;
    #h5l;
    #h6h;
    #h6l;
    #h7h;
    #h7l;
    constructor(bits1 = 512, sharedMemory3 = false){
        this.init(bits1, sharedMemory3);
    }
    init(bits, sharedMemory) {
        if (sharedMemory) {
            blocks1[0] = blocks1[1] = blocks1[2] = blocks1[3] = blocks1[4] = blocks1[5] = blocks1[6] = blocks1[7] = blocks1[8] = blocks1[9] = blocks1[10] = blocks1[11] = blocks1[12] = blocks1[13] = blocks1[14] = blocks1[15] = blocks1[16] = blocks1[17] = blocks1[18] = blocks1[19] = blocks1[20] = blocks1[21] = blocks1[22] = blocks1[23] = blocks1[24] = blocks1[25] = blocks1[26] = blocks1[27] = blocks1[28] = blocks1[29] = blocks1[30] = blocks1[31] = blocks1[32] = 0;
            this.#blocks = blocks1;
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
                0,
                0
            ];
        }
        if (bits === 224) {
            this.#h0h = 2352822216;
            this.#h0l = 424955298;
            this.#h1h = 1944164710;
            this.#h1l = 2312950998;
            this.#h2h = 502970286;
            this.#h2l = 855612546;
            this.#h3h = 1738396948;
            this.#h3l = 1479516111;
            this.#h4h = 258812777;
            this.#h4l = 2077511080;
            this.#h5h = 2011393907;
            this.#h5l = 79989058;
            this.#h6h = 1067287976;
            this.#h6l = 1780299464;
            this.#h7h = 286451373;
            this.#h7l = 2446758561;
        } else if (bits === 256) {
            this.#h0h = 573645204;
            this.#h0l = 4230739756;
            this.#h1h = 2673172387;
            this.#h1l = 3360449730;
            this.#h2h = 596883563;
            this.#h2l = 1867755857;
            this.#h3h = 2520282905;
            this.#h3l = 1497426621;
            this.#h4h = 2519219938;
            this.#h4l = 2827943907;
            this.#h5h = 3193839141;
            this.#h5l = 1401305490;
            this.#h6h = 721525244;
            this.#h6l = 746961066;
            this.#h7h = 246885852;
            this.#h7l = 2177182882;
        } else if (bits === 384) {
            this.#h0h = 3418070365;
            this.#h0l = 3238371032;
            this.#h1h = 1654270250;
            this.#h1l = 914150663;
            this.#h2h = 2438529370;
            this.#h2l = 812702999;
            this.#h3h = 355462360;
            this.#h3l = 4144912697;
            this.#h4h = 1731405415;
            this.#h4l = 4290775857;
            this.#h5h = 2394180231;
            this.#h5l = 1750603025;
            this.#h6h = 3675008525;
            this.#h6l = 1694076839;
            this.#h7h = 1203062813;
            this.#h7l = 3204075428;
        } else {
            this.#h0h = 1779033703;
            this.#h0l = 4089235720;
            this.#h1h = 3144134277;
            this.#h1l = 2227873595;
            this.#h2h = 1013904242;
            this.#h2l = 4271175723;
            this.#h3h = 2773480762;
            this.#h3l = 1595750129;
            this.#h4h = 1359893119;
            this.#h4l = 2917565137;
            this.#h5h = 2600822924;
            this.#h5l = 725511199;
            this.#h6h = 528734635;
            this.#h6l = 4215389547;
            this.#h7h = 1541459225;
            this.#h7l = 327033209;
        }
        this.#bits = bits;
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
        const length = msg.length;
        const blocks2 = this.#blocks;
        let index = 0;
        while(index < length){
            let i1;
            if (this.#hashed) {
                this.#hashed = false;
                blocks2[0] = this.#block;
                blocks2[1] = blocks2[2] = blocks2[3] = blocks2[4] = blocks2[5] = blocks2[6] = blocks2[7] = blocks2[8] = blocks2[9] = blocks2[10] = blocks2[11] = blocks2[12] = blocks2[13] = blocks2[14] = blocks2[15] = blocks2[16] = blocks2[17] = blocks2[18] = blocks2[19] = blocks2[20] = blocks2[21] = blocks2[22] = blocks2[23] = blocks2[24] = blocks2[25] = blocks2[26] = blocks2[27] = blocks2[28] = blocks2[29] = blocks2[30] = blocks2[31] = blocks2[32] = 0;
            }
            if (typeof msg !== "string") {
                for(i1 = this.#start; index < length && i1 < 128; ++index){
                    blocks2[i1 >> 2] |= msg[index] << SHIFT1[(i1++) & 3];
                }
            } else {
                for(i1 = this.#start; index < length && i1 < 128; ++index){
                    let code = msg.charCodeAt(index);
                    if (code < 128) {
                        blocks2[i1 >> 2] |= code << SHIFT1[(i1++) & 3];
                    } else if (code < 2048) {
                        blocks2[i1 >> 2] |= (192 | code >> 6) << SHIFT1[(i1++) & 3];
                        blocks2[i1 >> 2] |= (128 | code & 63) << SHIFT1[(i1++) & 3];
                    } else if (code < 55296 || code >= 57344) {
                        blocks2[i1 >> 2] |= (224 | code >> 12) << SHIFT1[(i1++) & 3];
                        blocks2[i1 >> 2] |= (128 | code >> 6 & 63) << SHIFT1[(i1++) & 3];
                        blocks2[i1 >> 2] |= (128 | code & 63) << SHIFT1[(i1++) & 3];
                    } else {
                        code = 65536 + ((code & 1023) << 10 | msg.charCodeAt(++index) & 1023);
                        blocks2[i1 >> 2] |= (240 | code >> 18) << SHIFT1[(i1++) & 3];
                        blocks2[i1 >> 2] |= (128 | code >> 12 & 63) << SHIFT1[(i1++) & 3];
                        blocks2[i1 >> 2] |= (128 | code >> 6 & 63) << SHIFT1[(i1++) & 3];
                        blocks2[i1 >> 2] |= (128 | code & 63) << SHIFT1[(i1++) & 3];
                    }
                }
            }
            this.#lastByteIndex = i1;
            this.#bytes += i1 - this.#start;
            if (i1 >= 128) {
                this.#block = blocks2[32];
                this.#start = i1 - 128;
                this.hash();
                this.#hashed = true;
            } else {
                this.#start = i1;
            }
        }
        if (this.#bytes > 4294967295) {
            this.#hBytes += this.#bytes / 4294967296 << 0;
            this.#bytes = this.#bytes % 4294967296;
        }
        return this;
    }
    finalize() {
        if (this.#finalized) {
            return;
        }
        this.#finalized = true;
        const blocks2 = this.#blocks;
        const i1 = this.#lastByteIndex;
        blocks2[32] = this.#block;
        blocks2[i1 >> 2] |= EXTRA1[i1 & 3];
        this.#block = blocks2[32];
        if (i1 >= 112) {
            if (!this.#hashed) {
                this.hash();
            }
            blocks2[0] = this.#block;
            blocks2[1] = blocks2[2] = blocks2[3] = blocks2[4] = blocks2[5] = blocks2[6] = blocks2[7] = blocks2[8] = blocks2[9] = blocks2[10] = blocks2[11] = blocks2[12] = blocks2[13] = blocks2[14] = blocks2[15] = blocks2[16] = blocks2[17] = blocks2[18] = blocks2[19] = blocks2[20] = blocks2[21] = blocks2[22] = blocks2[23] = blocks2[24] = blocks2[25] = blocks2[26] = blocks2[27] = blocks2[28] = blocks2[29] = blocks2[30] = blocks2[31] = blocks2[32] = 0;
        }
        blocks2[30] = this.#hBytes << 3 | this.#bytes >>> 29;
        blocks2[31] = this.#bytes << 3;
        this.hash();
    }
    hash() {
        const h0h = this.#h0h, h0l = this.#h0l, h1h = this.#h1h, h1l = this.#h1l, h2h = this.#h2h, h2l = this.#h2l, h3h = this.#h3h, h3l = this.#h3l, h4h = this.#h4h, h4l = this.#h4l, h5h = this.#h5h, h5l = this.#h5l, h6h = this.#h6h, h6l = this.#h6l, h7h = this.#h7h, h7l = this.#h7l;
        let s0h, s0l, s1h, s1l, c1, c2, c3, c4, abh, abl, dah, dal, cdh, cdl, bch, bcl, majh, majl, t1h, t1l, t2h, t2l, chh, chl;
        const blocks2 = this.#blocks;
        for(let j = 32; j < 160; j += 2){
            t1h = blocks2[j - 30];
            t1l = blocks2[j - 29];
            s0h = (t1h >>> 1 | t1l << 31) ^ (t1h >>> 8 | t1l << 24) ^ t1h >>> 7;
            s0l = (t1l >>> 1 | t1h << 31) ^ (t1l >>> 8 | t1h << 24) ^ (t1l >>> 7 | t1h << 25);
            t1h = blocks2[j - 4];
            t1l = blocks2[j - 3];
            s1h = (t1h >>> 19 | t1l << 13) ^ (t1l >>> 29 | t1h << 3) ^ t1h >>> 6;
            s1l = (t1l >>> 19 | t1h << 13) ^ (t1h >>> 29 | t1l << 3) ^ (t1l >>> 6 | t1h << 26);
            t1h = blocks2[j - 32];
            t1l = blocks2[j - 31];
            t2h = blocks2[j - 14];
            t2l = blocks2[j - 13];
            c1 = (t2l & 65535) + (t1l & 65535) + (s0l & 65535) + (s1l & 65535);
            c2 = (t2l >>> 16) + (t1l >>> 16) + (s0l >>> 16) + (s1l >>> 16) + (c1 >>> 16);
            c3 = (t2h & 65535) + (t1h & 65535) + (s0h & 65535) + (s1h & 65535) + (c2 >>> 16);
            c4 = (t2h >>> 16) + (t1h >>> 16) + (s0h >>> 16) + (s1h >>> 16) + (c3 >>> 16);
            blocks2[j] = c4 << 16 | c3 & 65535;
            blocks2[j + 1] = c2 << 16 | c1 & 65535;
        }
        let ah = h0h, al = h0l, bh = h1h, bl = h1l, ch = h2h, cl = h2l, dh = h3h, dl = h3l, eh = h4h, el = h4l, fh = h5h, fl = h5l, gh = h6h, gl = h6l, hh = h7h, hl = h7l;
        bch = bh & ch;
        bcl = bl & cl;
        for(let j1 = 0; j1 < 160; j1 += 8){
            s0h = (ah >>> 28 | al << 4) ^ (al >>> 2 | ah << 30) ^ (al >>> 7 | ah << 25);
            s0l = (al >>> 28 | ah << 4) ^ (ah >>> 2 | al << 30) ^ (ah >>> 7 | al << 25);
            s1h = (eh >>> 14 | el << 18) ^ (eh >>> 18 | el << 14) ^ (el >>> 9 | eh << 23);
            s1l = (el >>> 14 | eh << 18) ^ (el >>> 18 | eh << 14) ^ (eh >>> 9 | el << 23);
            abh = ah & bh;
            abl = al & bl;
            majh = abh ^ ah & ch ^ bch;
            majl = abl ^ al & cl ^ bcl;
            chh = eh & fh ^ ~eh & gh;
            chl = el & fl ^ ~el & gl;
            t1h = blocks2[j1];
            t1l = blocks2[j1 + 1];
            t2h = K1[j1];
            t2l = K1[j1 + 1];
            c1 = (t2l & 65535) + (t1l & 65535) + (chl & 65535) + (s1l & 65535) + (hl & 65535);
            c2 = (t2l >>> 16) + (t1l >>> 16) + (chl >>> 16) + (s1l >>> 16) + (hl >>> 16) + (c1 >>> 16);
            c3 = (t2h & 65535) + (t1h & 65535) + (chh & 65535) + (s1h & 65535) + (hh & 65535) + (c2 >>> 16);
            c4 = (t2h >>> 16) + (t1h >>> 16) + (chh >>> 16) + (s1h >>> 16) + (hh >>> 16) + (c3 >>> 16);
            t1h = c4 << 16 | c3 & 65535;
            t1l = c2 << 16 | c1 & 65535;
            c1 = (majl & 65535) + (s0l & 65535);
            c2 = (majl >>> 16) + (s0l >>> 16) + (c1 >>> 16);
            c3 = (majh & 65535) + (s0h & 65535) + (c2 >>> 16);
            c4 = (majh >>> 16) + (s0h >>> 16) + (c3 >>> 16);
            t2h = c4 << 16 | c3 & 65535;
            t2l = c2 << 16 | c1 & 65535;
            c1 = (dl & 65535) + (t1l & 65535);
            c2 = (dl >>> 16) + (t1l >>> 16) + (c1 >>> 16);
            c3 = (dh & 65535) + (t1h & 65535) + (c2 >>> 16);
            c4 = (dh >>> 16) + (t1h >>> 16) + (c3 >>> 16);
            hh = c4 << 16 | c3 & 65535;
            hl = c2 << 16 | c1 & 65535;
            c1 = (t2l & 65535) + (t1l & 65535);
            c2 = (t2l >>> 16) + (t1l >>> 16) + (c1 >>> 16);
            c3 = (t2h & 65535) + (t1h & 65535) + (c2 >>> 16);
            c4 = (t2h >>> 16) + (t1h >>> 16) + (c3 >>> 16);
            dh = c4 << 16 | c3 & 65535;
            dl = c2 << 16 | c1 & 65535;
            s0h = (dh >>> 28 | dl << 4) ^ (dl >>> 2 | dh << 30) ^ (dl >>> 7 | dh << 25);
            s0l = (dl >>> 28 | dh << 4) ^ (dh >>> 2 | dl << 30) ^ (dh >>> 7 | dl << 25);
            s1h = (hh >>> 14 | hl << 18) ^ (hh >>> 18 | hl << 14) ^ (hl >>> 9 | hh << 23);
            s1l = (hl >>> 14 | hh << 18) ^ (hl >>> 18 | hh << 14) ^ (hh >>> 9 | hl << 23);
            dah = dh & ah;
            dal = dl & al;
            majh = dah ^ dh & bh ^ abh;
            majl = dal ^ dl & bl ^ abl;
            chh = hh & eh ^ ~hh & fh;
            chl = hl & el ^ ~hl & fl;
            t1h = blocks2[j1 + 2];
            t1l = blocks2[j1 + 3];
            t2h = K1[j1 + 2];
            t2l = K1[j1 + 3];
            c1 = (t2l & 65535) + (t1l & 65535) + (chl & 65535) + (s1l & 65535) + (gl & 65535);
            c2 = (t2l >>> 16) + (t1l >>> 16) + (chl >>> 16) + (s1l >>> 16) + (gl >>> 16) + (c1 >>> 16);
            c3 = (t2h & 65535) + (t1h & 65535) + (chh & 65535) + (s1h & 65535) + (gh & 65535) + (c2 >>> 16);
            c4 = (t2h >>> 16) + (t1h >>> 16) + (chh >>> 16) + (s1h >>> 16) + (gh >>> 16) + (c3 >>> 16);
            t1h = c4 << 16 | c3 & 65535;
            t1l = c2 << 16 | c1 & 65535;
            c1 = (majl & 65535) + (s0l & 65535);
            c2 = (majl >>> 16) + (s0l >>> 16) + (c1 >>> 16);
            c3 = (majh & 65535) + (s0h & 65535) + (c2 >>> 16);
            c4 = (majh >>> 16) + (s0h >>> 16) + (c3 >>> 16);
            t2h = c4 << 16 | c3 & 65535;
            t2l = c2 << 16 | c1 & 65535;
            c1 = (cl & 65535) + (t1l & 65535);
            c2 = (cl >>> 16) + (t1l >>> 16) + (c1 >>> 16);
            c3 = (ch & 65535) + (t1h & 65535) + (c2 >>> 16);
            c4 = (ch >>> 16) + (t1h >>> 16) + (c3 >>> 16);
            gh = c4 << 16 | c3 & 65535;
            gl = c2 << 16 | c1 & 65535;
            c1 = (t2l & 65535) + (t1l & 65535);
            c2 = (t2l >>> 16) + (t1l >>> 16) + (c1 >>> 16);
            c3 = (t2h & 65535) + (t1h & 65535) + (c2 >>> 16);
            c4 = (t2h >>> 16) + (t1h >>> 16) + (c3 >>> 16);
            ch = c4 << 16 | c3 & 65535;
            cl = c2 << 16 | c1 & 65535;
            s0h = (ch >>> 28 | cl << 4) ^ (cl >>> 2 | ch << 30) ^ (cl >>> 7 | ch << 25);
            s0l = (cl >>> 28 | ch << 4) ^ (ch >>> 2 | cl << 30) ^ (ch >>> 7 | cl << 25);
            s1h = (gh >>> 14 | gl << 18) ^ (gh >>> 18 | gl << 14) ^ (gl >>> 9 | gh << 23);
            s1l = (gl >>> 14 | gh << 18) ^ (gl >>> 18 | gh << 14) ^ (gh >>> 9 | gl << 23);
            cdh = ch & dh;
            cdl = cl & dl;
            majh = cdh ^ ch & ah ^ dah;
            majl = cdl ^ cl & al ^ dal;
            chh = gh & hh ^ ~gh & eh;
            chl = gl & hl ^ ~gl & el;
            t1h = blocks2[j1 + 4];
            t1l = blocks2[j1 + 5];
            t2h = K1[j1 + 4];
            t2l = K1[j1 + 5];
            c1 = (t2l & 65535) + (t1l & 65535) + (chl & 65535) + (s1l & 65535) + (fl & 65535);
            c2 = (t2l >>> 16) + (t1l >>> 16) + (chl >>> 16) + (s1l >>> 16) + (fl >>> 16) + (c1 >>> 16);
            c3 = (t2h & 65535) + (t1h & 65535) + (chh & 65535) + (s1h & 65535) + (fh & 65535) + (c2 >>> 16);
            c4 = (t2h >>> 16) + (t1h >>> 16) + (chh >>> 16) + (s1h >>> 16) + (fh >>> 16) + (c3 >>> 16);
            t1h = c4 << 16 | c3 & 65535;
            t1l = c2 << 16 | c1 & 65535;
            c1 = (majl & 65535) + (s0l & 65535);
            c2 = (majl >>> 16) + (s0l >>> 16) + (c1 >>> 16);
            c3 = (majh & 65535) + (s0h & 65535) + (c2 >>> 16);
            c4 = (majh >>> 16) + (s0h >>> 16) + (c3 >>> 16);
            t2h = c4 << 16 | c3 & 65535;
            t2l = c2 << 16 | c1 & 65535;
            c1 = (bl & 65535) + (t1l & 65535);
            c2 = (bl >>> 16) + (t1l >>> 16) + (c1 >>> 16);
            c3 = (bh & 65535) + (t1h & 65535) + (c2 >>> 16);
            c4 = (bh >>> 16) + (t1h >>> 16) + (c3 >>> 16);
            fh = c4 << 16 | c3 & 65535;
            fl = c2 << 16 | c1 & 65535;
            c1 = (t2l & 65535) + (t1l & 65535);
            c2 = (t2l >>> 16) + (t1l >>> 16) + (c1 >>> 16);
            c3 = (t2h & 65535) + (t1h & 65535) + (c2 >>> 16);
            c4 = (t2h >>> 16) + (t1h >>> 16) + (c3 >>> 16);
            bh = c4 << 16 | c3 & 65535;
            bl = c2 << 16 | c1 & 65535;
            s0h = (bh >>> 28 | bl << 4) ^ (bl >>> 2 | bh << 30) ^ (bl >>> 7 | bh << 25);
            s0l = (bl >>> 28 | bh << 4) ^ (bh >>> 2 | bl << 30) ^ (bh >>> 7 | bl << 25);
            s1h = (fh >>> 14 | fl << 18) ^ (fh >>> 18 | fl << 14) ^ (fl >>> 9 | fh << 23);
            s1l = (fl >>> 14 | fh << 18) ^ (fl >>> 18 | fh << 14) ^ (fh >>> 9 | fl << 23);
            bch = bh & ch;
            bcl = bl & cl;
            majh = bch ^ bh & dh ^ cdh;
            majl = bcl ^ bl & dl ^ cdl;
            chh = fh & gh ^ ~fh & hh;
            chl = fl & gl ^ ~fl & hl;
            t1h = blocks2[j1 + 6];
            t1l = blocks2[j1 + 7];
            t2h = K1[j1 + 6];
            t2l = K1[j1 + 7];
            c1 = (t2l & 65535) + (t1l & 65535) + (chl & 65535) + (s1l & 65535) + (el & 65535);
            c2 = (t2l >>> 16) + (t1l >>> 16) + (chl >>> 16) + (s1l >>> 16) + (el >>> 16) + (c1 >>> 16);
            c3 = (t2h & 65535) + (t1h & 65535) + (chh & 65535) + (s1h & 65535) + (eh & 65535) + (c2 >>> 16);
            c4 = (t2h >>> 16) + (t1h >>> 16) + (chh >>> 16) + (s1h >>> 16) + (eh >>> 16) + (c3 >>> 16);
            t1h = c4 << 16 | c3 & 65535;
            t1l = c2 << 16 | c1 & 65535;
            c1 = (majl & 65535) + (s0l & 65535);
            c2 = (majl >>> 16) + (s0l >>> 16) + (c1 >>> 16);
            c3 = (majh & 65535) + (s0h & 65535) + (c2 >>> 16);
            c4 = (majh >>> 16) + (s0h >>> 16) + (c3 >>> 16);
            t2h = c4 << 16 | c3 & 65535;
            t2l = c2 << 16 | c1 & 65535;
            c1 = (al & 65535) + (t1l & 65535);
            c2 = (al >>> 16) + (t1l >>> 16) + (c1 >>> 16);
            c3 = (ah & 65535) + (t1h & 65535) + (c2 >>> 16);
            c4 = (ah >>> 16) + (t1h >>> 16) + (c3 >>> 16);
            eh = c4 << 16 | c3 & 65535;
            el = c2 << 16 | c1 & 65535;
            c1 = (t2l & 65535) + (t1l & 65535);
            c2 = (t2l >>> 16) + (t1l >>> 16) + (c1 >>> 16);
            c3 = (t2h & 65535) + (t1h & 65535) + (c2 >>> 16);
            c4 = (t2h >>> 16) + (t1h >>> 16) + (c3 >>> 16);
            ah = c4 << 16 | c3 & 65535;
            al = c2 << 16 | c1 & 65535;
        }
        c1 = (h0l & 65535) + (al & 65535);
        c2 = (h0l >>> 16) + (al >>> 16) + (c1 >>> 16);
        c3 = (h0h & 65535) + (ah & 65535) + (c2 >>> 16);
        c4 = (h0h >>> 16) + (ah >>> 16) + (c3 >>> 16);
        this.#h0h = c4 << 16 | c3 & 65535;
        this.#h0l = c2 << 16 | c1 & 65535;
        c1 = (h1l & 65535) + (bl & 65535);
        c2 = (h1l >>> 16) + (bl >>> 16) + (c1 >>> 16);
        c3 = (h1h & 65535) + (bh & 65535) + (c2 >>> 16);
        c4 = (h1h >>> 16) + (bh >>> 16) + (c3 >>> 16);
        this.#h1h = c4 << 16 | c3 & 65535;
        this.#h1l = c2 << 16 | c1 & 65535;
        c1 = (h2l & 65535) + (cl & 65535);
        c2 = (h2l >>> 16) + (cl >>> 16) + (c1 >>> 16);
        c3 = (h2h & 65535) + (ch & 65535) + (c2 >>> 16);
        c4 = (h2h >>> 16) + (ch >>> 16) + (c3 >>> 16);
        this.#h2h = c4 << 16 | c3 & 65535;
        this.#h2l = c2 << 16 | c1 & 65535;
        c1 = (h3l & 65535) + (dl & 65535);
        c2 = (h3l >>> 16) + (dl >>> 16) + (c1 >>> 16);
        c3 = (h3h & 65535) + (dh & 65535) + (c2 >>> 16);
        c4 = (h3h >>> 16) + (dh >>> 16) + (c3 >>> 16);
        this.#h3h = c4 << 16 | c3 & 65535;
        this.#h3l = c2 << 16 | c1 & 65535;
        c1 = (h4l & 65535) + (el & 65535);
        c2 = (h4l >>> 16) + (el >>> 16) + (c1 >>> 16);
        c3 = (h4h & 65535) + (eh & 65535) + (c2 >>> 16);
        c4 = (h4h >>> 16) + (eh >>> 16) + (c3 >>> 16);
        this.#h4h = c4 << 16 | c3 & 65535;
        this.#h4l = c2 << 16 | c1 & 65535;
        c1 = (h5l & 65535) + (fl & 65535);
        c2 = (h5l >>> 16) + (fl >>> 16) + (c1 >>> 16);
        c3 = (h5h & 65535) + (fh & 65535) + (c2 >>> 16);
        c4 = (h5h >>> 16) + (fh >>> 16) + (c3 >>> 16);
        this.#h5h = c4 << 16 | c3 & 65535;
        this.#h5l = c2 << 16 | c1 & 65535;
        c1 = (h6l & 65535) + (gl & 65535);
        c2 = (h6l >>> 16) + (gl >>> 16) + (c1 >>> 16);
        c3 = (h6h & 65535) + (gh & 65535) + (c2 >>> 16);
        c4 = (h6h >>> 16) + (gh >>> 16) + (c3 >>> 16);
        this.#h6h = c4 << 16 | c3 & 65535;
        this.#h6l = c2 << 16 | c1 & 65535;
        c1 = (h7l & 65535) + (hl & 65535);
        c2 = (h7l >>> 16) + (hl >>> 16) + (c1 >>> 16);
        c3 = (h7h & 65535) + (hh & 65535) + (c2 >>> 16);
        c4 = (h7h >>> 16) + (hh >>> 16) + (c3 >>> 16);
        this.#h7h = c4 << 16 | c3 & 65535;
        this.#h7l = c2 << 16 | c1 & 65535;
    }
    hex() {
        this.finalize();
        const h0h = this.#h0h, h0l = this.#h0l, h1h = this.#h1h, h1l = this.#h1l, h2h = this.#h2h, h2l = this.#h2l, h3h = this.#h3h, h3l = this.#h3l, h4h = this.#h4h, h4l = this.#h4l, h5h = this.#h5h, h5l = this.#h5l, h6h = this.#h6h, h6l = this.#h6l, h7h = this.#h7h, h7l = this.#h7l, bits2 = this.#bits;
        let hex = HEX_CHARS1[h0h >> 28 & 15] + HEX_CHARS1[h0h >> 24 & 15] + HEX_CHARS1[h0h >> 20 & 15] + HEX_CHARS1[h0h >> 16 & 15] + HEX_CHARS1[h0h >> 12 & 15] + HEX_CHARS1[h0h >> 8 & 15] + HEX_CHARS1[h0h >> 4 & 15] + HEX_CHARS1[h0h & 15] + HEX_CHARS1[h0l >> 28 & 15] + HEX_CHARS1[h0l >> 24 & 15] + HEX_CHARS1[h0l >> 20 & 15] + HEX_CHARS1[h0l >> 16 & 15] + HEX_CHARS1[h0l >> 12 & 15] + HEX_CHARS1[h0l >> 8 & 15] + HEX_CHARS1[h0l >> 4 & 15] + HEX_CHARS1[h0l & 15] + HEX_CHARS1[h1h >> 28 & 15] + HEX_CHARS1[h1h >> 24 & 15] + HEX_CHARS1[h1h >> 20 & 15] + HEX_CHARS1[h1h >> 16 & 15] + HEX_CHARS1[h1h >> 12 & 15] + HEX_CHARS1[h1h >> 8 & 15] + HEX_CHARS1[h1h >> 4 & 15] + HEX_CHARS1[h1h & 15] + HEX_CHARS1[h1l >> 28 & 15] + HEX_CHARS1[h1l >> 24 & 15] + HEX_CHARS1[h1l >> 20 & 15] + HEX_CHARS1[h1l >> 16 & 15] + HEX_CHARS1[h1l >> 12 & 15] + HEX_CHARS1[h1l >> 8 & 15] + HEX_CHARS1[h1l >> 4 & 15] + HEX_CHARS1[h1l & 15] + HEX_CHARS1[h2h >> 28 & 15] + HEX_CHARS1[h2h >> 24 & 15] + HEX_CHARS1[h2h >> 20 & 15] + HEX_CHARS1[h2h >> 16 & 15] + HEX_CHARS1[h2h >> 12 & 15] + HEX_CHARS1[h2h >> 8 & 15] + HEX_CHARS1[h2h >> 4 & 15] + HEX_CHARS1[h2h & 15] + HEX_CHARS1[h2l >> 28 & 15] + HEX_CHARS1[h2l >> 24 & 15] + HEX_CHARS1[h2l >> 20 & 15] + HEX_CHARS1[h2l >> 16 & 15] + HEX_CHARS1[h2l >> 12 & 15] + HEX_CHARS1[h2l >> 8 & 15] + HEX_CHARS1[h2l >> 4 & 15] + HEX_CHARS1[h2l & 15] + HEX_CHARS1[h3h >> 28 & 15] + HEX_CHARS1[h3h >> 24 & 15] + HEX_CHARS1[h3h >> 20 & 15] + HEX_CHARS1[h3h >> 16 & 15] + HEX_CHARS1[h3h >> 12 & 15] + HEX_CHARS1[h3h >> 8 & 15] + HEX_CHARS1[h3h >> 4 & 15] + HEX_CHARS1[h3h & 15];
        if (bits2 >= 256) {
            hex += HEX_CHARS1[h3l >> 28 & 15] + HEX_CHARS1[h3l >> 24 & 15] + HEX_CHARS1[h3l >> 20 & 15] + HEX_CHARS1[h3l >> 16 & 15] + HEX_CHARS1[h3l >> 12 & 15] + HEX_CHARS1[h3l >> 8 & 15] + HEX_CHARS1[h3l >> 4 & 15] + HEX_CHARS1[h3l & 15];
        }
        if (bits2 >= 384) {
            hex += HEX_CHARS1[h4h >> 28 & 15] + HEX_CHARS1[h4h >> 24 & 15] + HEX_CHARS1[h4h >> 20 & 15] + HEX_CHARS1[h4h >> 16 & 15] + HEX_CHARS1[h4h >> 12 & 15] + HEX_CHARS1[h4h >> 8 & 15] + HEX_CHARS1[h4h >> 4 & 15] + HEX_CHARS1[h4h & 15] + HEX_CHARS1[h4l >> 28 & 15] + HEX_CHARS1[h4l >> 24 & 15] + HEX_CHARS1[h4l >> 20 & 15] + HEX_CHARS1[h4l >> 16 & 15] + HEX_CHARS1[h4l >> 12 & 15] + HEX_CHARS1[h4l >> 8 & 15] + HEX_CHARS1[h4l >> 4 & 15] + HEX_CHARS1[h4l & 15] + HEX_CHARS1[h5h >> 28 & 15] + HEX_CHARS1[h5h >> 24 & 15] + HEX_CHARS1[h5h >> 20 & 15] + HEX_CHARS1[h5h >> 16 & 15] + HEX_CHARS1[h5h >> 12 & 15] + HEX_CHARS1[h5h >> 8 & 15] + HEX_CHARS1[h5h >> 4 & 15] + HEX_CHARS1[h5h & 15] + HEX_CHARS1[h5l >> 28 & 15] + HEX_CHARS1[h5l >> 24 & 15] + HEX_CHARS1[h5l >> 20 & 15] + HEX_CHARS1[h5l >> 16 & 15] + HEX_CHARS1[h5l >> 12 & 15] + HEX_CHARS1[h5l >> 8 & 15] + HEX_CHARS1[h5l >> 4 & 15] + HEX_CHARS1[h5l & 15];
        }
        if (bits2 === 512) {
            hex += HEX_CHARS1[h6h >> 28 & 15] + HEX_CHARS1[h6h >> 24 & 15] + HEX_CHARS1[h6h >> 20 & 15] + HEX_CHARS1[h6h >> 16 & 15] + HEX_CHARS1[h6h >> 12 & 15] + HEX_CHARS1[h6h >> 8 & 15] + HEX_CHARS1[h6h >> 4 & 15] + HEX_CHARS1[h6h & 15] + HEX_CHARS1[h6l >> 28 & 15] + HEX_CHARS1[h6l >> 24 & 15] + HEX_CHARS1[h6l >> 20 & 15] + HEX_CHARS1[h6l >> 16 & 15] + HEX_CHARS1[h6l >> 12 & 15] + HEX_CHARS1[h6l >> 8 & 15] + HEX_CHARS1[h6l >> 4 & 15] + HEX_CHARS1[h6l & 15] + HEX_CHARS1[h7h >> 28 & 15] + HEX_CHARS1[h7h >> 24 & 15] + HEX_CHARS1[h7h >> 20 & 15] + HEX_CHARS1[h7h >> 16 & 15] + HEX_CHARS1[h7h >> 12 & 15] + HEX_CHARS1[h7h >> 8 & 15] + HEX_CHARS1[h7h >> 4 & 15] + HEX_CHARS1[h7h & 15] + HEX_CHARS1[h7l >> 28 & 15] + HEX_CHARS1[h7l >> 24 & 15] + HEX_CHARS1[h7l >> 20 & 15] + HEX_CHARS1[h7l >> 16 & 15] + HEX_CHARS1[h7l >> 12 & 15] + HEX_CHARS1[h7l >> 8 & 15] + HEX_CHARS1[h7l >> 4 & 15] + HEX_CHARS1[h7l & 15];
        }
        return hex;
    }
    toString() {
        return this.hex();
    }
    digest() {
        this.finalize();
        const h0h = this.#h0h, h0l = this.#h0l, h1h = this.#h1h, h1l = this.#h1l, h2h = this.#h2h, h2l = this.#h2l, h3h = this.#h3h, h3l = this.#h3l, h4h = this.#h4h, h4l = this.#h4l, h5h = this.#h5h, h5l = this.#h5l, h6h = this.#h6h, h6l = this.#h6l, h7h = this.#h7h, h7l = this.#h7l, bits2 = this.#bits;
        const arr = [
            h0h >> 24 & 255,
            h0h >> 16 & 255,
            h0h >> 8 & 255,
            h0h & 255,
            h0l >> 24 & 255,
            h0l >> 16 & 255,
            h0l >> 8 & 255,
            h0l & 255,
            h1h >> 24 & 255,
            h1h >> 16 & 255,
            h1h >> 8 & 255,
            h1h & 255,
            h1l >> 24 & 255,
            h1l >> 16 & 255,
            h1l >> 8 & 255,
            h1l & 255,
            h2h >> 24 & 255,
            h2h >> 16 & 255,
            h2h >> 8 & 255,
            h2h & 255,
            h2l >> 24 & 255,
            h2l >> 16 & 255,
            h2l >> 8 & 255,
            h2l & 255,
            h3h >> 24 & 255,
            h3h >> 16 & 255,
            h3h >> 8 & 255,
            h3h & 255
        ];
        if (bits2 >= 256) {
            arr.push(h3l >> 24 & 255, h3l >> 16 & 255, h3l >> 8 & 255, h3l & 255);
        }
        if (bits2 >= 384) {
            arr.push(h4h >> 24 & 255, h4h >> 16 & 255, h4h >> 8 & 255, h4h & 255, h4l >> 24 & 255, h4l >> 16 & 255, h4l >> 8 & 255, h4l & 255, h5h >> 24 & 255, h5h >> 16 & 255, h5h >> 8 & 255, h5h & 255, h5l >> 24 & 255, h5l >> 16 & 255, h5l >> 8 & 255, h5l & 255);
        }
        if (bits2 === 512) {
            arr.push(h6h >> 24 & 255, h6h >> 16 & 255, h6h >> 8 & 255, h6h & 255, h6l >> 24 & 255, h6l >> 16 & 255, h6l >> 8 & 255, h6l & 255, h7h >> 24 & 255, h7h >> 16 & 255, h7h >> 8 & 255, h7h & 255, h7l >> 24 & 255, h7l >> 16 & 255, h7l >> 8 & 255, h7l & 255);
        }
        return arr;
    }
    array() {
        return this.digest();
    }
    arrayBuffer() {
        this.finalize();
        const bits2 = this.#bits;
        const buffer = new ArrayBuffer(bits2 / 8);
        const dataView = new DataView(buffer);
        dataView.setUint32(0, this.#h0h);
        dataView.setUint32(4, this.#h0l);
        dataView.setUint32(8, this.#h1h);
        dataView.setUint32(12, this.#h1l);
        dataView.setUint32(16, this.#h2h);
        dataView.setUint32(20, this.#h2l);
        dataView.setUint32(24, this.#h3h);
        if (bits2 >= 256) {
            dataView.setUint32(28, this.#h3l);
        }
        if (bits2 >= 384) {
            dataView.setUint32(32, this.#h4h);
            dataView.setUint32(36, this.#h4l);
            dataView.setUint32(40, this.#h5h);
            dataView.setUint32(44, this.#h5l);
        }
        if (bits2 === 512) {
            dataView.setUint32(48, this.#h6h);
            dataView.setUint32(52, this.#h6l);
            dataView.setUint32(56, this.#h7h);
            dataView.setUint32(60, this.#h7l);
        }
        return buffer;
    }
}
class HmacSha512 extends Sha512 {
    #inner;
    #bits;
    #oKeyPad;
    #sharedMemory;
    constructor(secretKey1, bits2 = 512, sharedMemory4 = false){
        super(bits2, sharedMemory4);
        let key5;
        if (secretKey1 instanceof ArrayBuffer) {
            key5 = new Uint8Array(secretKey1);
        } else if (typeof secretKey1 === "string") {
            const bytes = [];
            const length = secretKey1.length;
            let index = 0;
            let code;
            for(let i1 = 0; i1 < length; ++i1){
                code = secretKey1.charCodeAt(i1);
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
                    code = 65536 + ((code & 1023) << 10 | secretKey1.charCodeAt(++i1) & 1023);
                    bytes[index++] = 240 | code >> 18;
                    bytes[index++] = 128 | code >> 12 & 63;
                    bytes[index++] = 128 | code >> 6 & 63;
                    bytes[index++] = 128 | code & 63;
                }
            }
            key5 = bytes;
        } else {
            key5 = secretKey1;
        }
        if (key5.length > 128) {
            key5 = new Sha512(bits2, true).update(key5).array();
        }
        const oKeyPad1 = [];
        const iKeyPad1 = [];
        for(let i1 = 0; i1 < 128; ++i1){
            const b = key5[i1] || 0;
            oKeyPad1[i1] = 92 ^ b;
            iKeyPad1[i1] = 54 ^ b;
        }
        this.update(iKeyPad1);
        this.#inner = true;
        this.#bits = bits2;
        this.#oKeyPad = oKeyPad1;
        this.#sharedMemory = sharedMemory4;
    }
    finalize() {
        super.finalize();
        if (this.#inner) {
            this.#inner = false;
            const innerHash = this.array();
            super.init(this.#bits, this.#sharedMemory);
            this.update(this.#oKeyPad);
            this.update(innerHash);
            super.finalize();
        }
    }
}
function big_base641(m) {
    if (m === undefined) return undefined;
    const bytes = [];
    while(m > 0n){
        bytes.push(Number(m & 255n));
        m = m >> 8n;
    }
    bytes.reverse();
    let a = btoa(String.fromCharCode.apply(null, bytes)).replace(/=/g, "");
    a = a.replace(/\+/g, "-");
    a = a.replace(/\//g, "_");
    return a;
}
function getHashFunctionName1(hash) {
    if (hash === "sha1") return "SHA-1";
    if (hash === "sha256") return "SHA-256";
    return "";
}
async function createWebCryptoKey1(key6, usage, options2) {
    let jwk = {
        kty: "RSA",
        n: big_base641(key6.n),
        ext: true
    };
    if (usage === "encrypt") {
        jwk = {
            ...jwk,
            e: big_base641(key6.e)
        };
    } else if (usage === "decrypt") {
        jwk = {
            ...jwk,
            d: big_base641(key6.d),
            e: big_base641(key6.e),
            p: big_base641(key6.p),
            q: big_base641(key6.q),
            dp: big_base641(key6.dp),
            dq: big_base641(key6.dq),
            qi: big_base641(key6.qi)
        };
    }
    return await crypto.subtle.importKey("jwk", jwk, {
        name: "RSA-OAEP",
        hash: {
            name: getHashFunctionName1(options2.hash)
        }
    }, false, [
        usage
    ]);
}
class WebCryptoRSA1 {
    encryptedKey = null;
    decryptedKey = null;
    constructor(key6, options2){
        this.key = key6;
        this.options = options2;
    }
    static isSupported(options) {
        if (!crypto.subtle) return false;
        if (options.padding !== "oaep") return false;
        return true;
    }
    static async encrypt(key, m, options) {
        return await crypto.subtle.encrypt({
            name: "RSA-OAEP"
        }, await createWebCryptoKey1(key, "encrypt", options), m);
    }
    static async decrypt(key, m, options) {
        return await crypto.subtle.decrypt({
            name: "RSA-OAEP"
        }, await createWebCryptoKey1(key, "decrypt", options), m);
    }
}
function power_mod1(n, p, m) {
    if (p === 1n) return n;
    if (p % 2n === 0n) {
        const t = power_mod1(n, p >> 1n, m);
        return t * t % m;
    } else {
        const t = power_mod1(n, p >> 1n, m);
        return t * t * n % m;
    }
}
function rsaep1(n, e, m) {
    return power_mod1(m, e, n);
}
function rsadp1(key7, c) {
    if (!key7.d) throw "Invalid RSA key";
    if (key7.dp && key7.dq && key7.qi && key7.q && key7.p) {
        const m1 = power_mod1(c % key7.p, key7.dp, key7.p);
        const m2 = power_mod1(c % key7.q, key7.dq, key7.q);
        let h = 0n;
        if (m1 >= m2) {
            h = key7.qi * (m1 - m2) % key7.p;
        } else {
            h = key7.qi * (m1 - m2 + key7.p * (key7.p / key7.q)) % key7.p;
        }
        return (m2 + h * key7.q) % (key7.q * key7.p);
    } else {
        return power_mod1(c, key7.d, key7.n);
    }
}
function detect_format1(key7) {
    if (typeof key7 === "object") {
        if (key7.kty === "RSA") return "jwk";
    } else if (typeof key7 === "string") {
        if (key7.substr(0, "-----".length) === "-----") return "pem";
    }
    throw new TypeError("Unsupported key format");
}
function createSizeBuffer1(size) {
    if (size <= 127) return new Uint8Array([
        size
    ]);
    const bytes = [];
    while(size > 0){
        bytes.push(size & 255);
        size = size >> 8;
    }
    bytes.reverse();
    return new Uint8Array([
        128 + bytes.length,
        ...bytes
    ]);
}
class BER1 {
    static createSequence(children) {
        const size = children.reduce((accumlatedSize, child)=>accumlatedSize + child.length
        , 0);
        return new Uint8Array([
            48,
            ...createSizeBuffer1(size),
            ...children.reduce((buffer, child)=>[
                    ...buffer,
                    ...child
                ]
            , []), 
        ]);
    }
    static createNull() {
        return new Uint8Array([
            5,
            0
        ]);
    }
    static createBoolean(value) {
        return new Uint8Array([
            1,
            1,
            value ? 1 : 0
        ]);
    }
    static createInteger(value) {
        if (typeof value === "number") return BER1.createBigInteger(BigInt(value));
        return BER1.createBigInteger(value);
    }
    static createBigInteger(value) {
        if (value === 0n) return new Uint8Array([
            2,
            1,
            0
        ]);
        const isNegative = value < 0;
        const content = [];
        let n = isNegative ? -value : value;
        while(n > 0n){
            content.push(Number(n & 255n));
            n = n >> 8n;
        }
        if (!isNegative) {
            if (content[content.length - 1] & 128) content.push(0);
        } else {
            for(let i2 = 0; i2 < content.length; i2++)content[i2] = 256 - content[i2];
            if (!(content[content.length - 1] & 128)) content.push(255);
        }
        content.reverse();
        return new Uint8Array([
            2,
            ...createSizeBuffer1(content.length),
            ...content, 
        ]);
    }
    static createBitString(value) {
        return new Uint8Array([
            3,
            ...createSizeBuffer1(value.length + 1),
            0,
            ...value, 
        ]);
    }
}
function add_line_break1(base64_str) {
    const lines = [];
    for(let i2 = 0; i2 < base64_str.length; i2 += 64){
        lines.push(base64_str.substr(i2, 64));
    }
    return lines.join("\n");
}
function computeMessage2(m) {
    return typeof m === "string" ? new TextEncoder().encode(m) : m;
}
function computeOption1(options3) {
    return {
        hash: "sha1",
        padding: "oaep",
        ...options3
    };
}
function assertNever(alg, message) {
    throw new RangeError(message);
}
function safeCompare(a, b) {
    const strA = String(a);
    const lenA = strA.length;
    let strB = String(b);
    let result = 0;
    if (lenA !== strB.length) {
        strB = strA;
        result = 1;
    }
    for(let i2 = 0; i2 < lenA; i2++){
        result |= strA.charCodeAt(i2) ^ strB.charCodeAt(i2);
    }
    return result === 0;
}
function verify(algorithm, jwtAlg) {
    return Array.isArray(algorithm) ? algorithm.includes(jwtAlg) : algorithm === jwtAlg;
}
const encoder = new TextEncoder();
const decoder = new TextDecoder();
function isExpired(exp, leeway = 0) {
    return exp + leeway < Date.now() / 1000;
}
function isTooEarly(nbf, leeway = 0) {
    return nbf - leeway > Date.now() / 1000;
}
function isObject(obj) {
    return obj !== null && typeof obj === "object" && Array.isArray(obj) === false;
}
function hasInvalidTimingClaims(...claimValues) {
    return claimValues.some((claimValue)=>claimValue !== undefined ? typeof claimValue !== "number" : false
    );
}
function decode(jwt) {
    const [header, payload, signature] = jwt.split(".").map(mod.decode).map((uint8Array, index)=>{
        switch(index){
            case 0:
            case 1:
                try {
                    return JSON.parse(decoder.decode(uint8Array));
                } catch  {
                    break;
                }
            case 2:
                return encodeToString(uint8Array);
        }
        throw TypeError("The serialization is invalid.");
    });
    if (typeof signature !== "string") {
        throw new Error(`The signature is missing.`);
    }
    if (typeof header?.alg !== "string") {
        throw new Error(`The header 'alg' parameter must be a string.`);
    }
    if (!isObject(payload)) {
        throw new Error(`The jwt claims set is not a JSON object.`);
    }
    if (hasInvalidTimingClaims(payload.exp, payload.nbf)) {
        throw new Error(`The jwt has an invalid 'exp' or 'nbf' claim.`);
    }
    if (typeof payload.exp === "number" && isExpired(payload.exp, 1)) {
        throw RangeError("The jwt is expired.");
    }
    if (typeof payload.nbf === "number" && isTooEarly(payload.nbf, 1)) {
        throw RangeError("The jwt is used too early.");
    }
    return {
        header,
        payload,
        signature
    };
}
function createSigningInput(header, payload) {
    return `${mod.encode(encoder.encode(JSON.stringify(header)))}.${mod.encode(encoder.encode(JSON.stringify(payload)))}`;
}
function assert(expr, msg = "") {
    if (!expr) {
        throw new DenoStdInternalError(msg);
    }
}
class Tokenizer {
    constructor(rules = []){
        this.rules = rules;
    }
    addRule(test, fn) {
        this.rules.push({
            test,
            fn
        });
        return this;
    }
    tokenize(string, receiver = (token)=>token
    ) {
        function* generator(rules1) {
            let index = 0;
            for (const rule of rules1){
                const result = rule.test(string);
                if (result) {
                    const { value , length  } = result;
                    index += length;
                    string = string.slice(length);
                    const token = {
                        ...rule.fn(value),
                        index
                    };
                    yield receiver(token);
                    yield* generator(rules1);
                }
            }
        }
        const tokenGenerator = generator(this.rules);
        const tokens = [];
        for (const token of tokenGenerator){
            tokens.push(token);
        }
        if (string.length) {
            throw new Error(`parser error: string not fully parsed! ${string.slice(0, 25)}`);
        }
        return tokens;
    }
}
function digits(value, count = 2) {
    return String(value).padStart(count, "0");
}
function createLiteralTestFunction(value) {
    return (string)=>{
        return string.startsWith(value) ? {
            value,
            length: value.length
        } : undefined;
    };
}
function createMatchTestFunction(match) {
    return (string)=>{
        const result = match.exec(string);
        if (result) return {
            value: result,
            length: result[0].length
        };
    };
}
const defaultRules = [
    {
        test: createLiteralTestFunction("yyyy"),
        fn: ()=>({
                type: "year",
                value: "numeric"
            })
    },
    {
        test: createLiteralTestFunction("yy"),
        fn: ()=>({
                type: "year",
                value: "2-digit"
            })
    },
    {
        test: createLiteralTestFunction("MM"),
        fn: ()=>({
                type: "month",
                value: "2-digit"
            })
    },
    {
        test: createLiteralTestFunction("M"),
        fn: ()=>({
                type: "month",
                value: "numeric"
            })
    },
    {
        test: createLiteralTestFunction("dd"),
        fn: ()=>({
                type: "day",
                value: "2-digit"
            })
    },
    {
        test: createLiteralTestFunction("d"),
        fn: ()=>({
                type: "day",
                value: "numeric"
            })
    },
    {
        test: createLiteralTestFunction("HH"),
        fn: ()=>({
                type: "hour",
                value: "2-digit"
            })
    },
    {
        test: createLiteralTestFunction("H"),
        fn: ()=>({
                type: "hour",
                value: "numeric"
            })
    },
    {
        test: createLiteralTestFunction("hh"),
        fn: ()=>({
                type: "hour",
                value: "2-digit",
                hour12: true
            })
    },
    {
        test: createLiteralTestFunction("h"),
        fn: ()=>({
                type: "hour",
                value: "numeric",
                hour12: true
            })
    },
    {
        test: createLiteralTestFunction("mm"),
        fn: ()=>({
                type: "minute",
                value: "2-digit"
            })
    },
    {
        test: createLiteralTestFunction("m"),
        fn: ()=>({
                type: "minute",
                value: "numeric"
            })
    },
    {
        test: createLiteralTestFunction("ss"),
        fn: ()=>({
                type: "second",
                value: "2-digit"
            })
    },
    {
        test: createLiteralTestFunction("s"),
        fn: ()=>({
                type: "second",
                value: "numeric"
            })
    },
    {
        test: createLiteralTestFunction("SSS"),
        fn: ()=>({
                type: "fractionalSecond",
                value: 3
            })
    },
    {
        test: createLiteralTestFunction("SS"),
        fn: ()=>({
                type: "fractionalSecond",
                value: 2
            })
    },
    {
        test: createLiteralTestFunction("S"),
        fn: ()=>({
                type: "fractionalSecond",
                value: 1
            })
    },
    {
        test: createLiteralTestFunction("a"),
        fn: (value)=>({
                type: "dayPeriod",
                value: value
            })
    },
    {
        test: createMatchTestFunction(/^(')(?<value>\\.|[^\']*)\1/),
        fn: (match)=>({
                type: "literal",
                value: match.groups.value
            })
    },
    {
        test: createMatchTestFunction(/^.+?\s*/),
        fn: (match)=>({
                type: "literal",
                value: match[0]
            })
    }, 
];
class DateTimeFormatter {
    #format;
    constructor(formatString, rules1 = defaultRules){
        const tokenizer = new Tokenizer(rules1);
        this.#format = tokenizer.tokenize(formatString, ({ type , value , hour12  })=>{
            const result = {
                type,
                value
            };
            if (hour12) result.hour12 = hour12;
            return result;
        });
    }
    format(date, options = {
    }) {
        let string = "";
        const utc = options.timeZone === "UTC";
        for (const token of this.#format){
            const type = token.type;
            switch(type){
                case "year":
                    {
                        const value = utc ? date.getUTCFullYear() : date.getFullYear();
                        switch(token.value){
                            case "numeric":
                                {
                                    string += value;
                                    break;
                                }
                            case "2-digit":
                                {
                                    string += digits(value, 2).slice(-2);
                                    break;
                                }
                            default:
                                throw Error(`FormatterError: value "${token.value}" is not supported`);
                        }
                        break;
                    }
                case "month":
                    {
                        const value = (utc ? date.getUTCMonth() : date.getMonth()) + 1;
                        switch(token.value){
                            case "numeric":
                                {
                                    string += value;
                                    break;
                                }
                            case "2-digit":
                                {
                                    string += digits(value, 2);
                                    break;
                                }
                            default:
                                throw Error(`FormatterError: value "${token.value}" is not supported`);
                        }
                        break;
                    }
                case "day":
                    {
                        const value = utc ? date.getUTCDate() : date.getDate();
                        switch(token.value){
                            case "numeric":
                                {
                                    string += value;
                                    break;
                                }
                            case "2-digit":
                                {
                                    string += digits(value, 2);
                                    break;
                                }
                            default:
                                throw Error(`FormatterError: value "${token.value}" is not supported`);
                        }
                        break;
                    }
                case "hour":
                    {
                        let value = utc ? date.getUTCHours() : date.getHours();
                        value -= token.hour12 && date.getHours() > 12 ? 12 : 0;
                        switch(token.value){
                            case "numeric":
                                {
                                    string += value;
                                    break;
                                }
                            case "2-digit":
                                {
                                    string += digits(value, 2);
                                    break;
                                }
                            default:
                                throw Error(`FormatterError: value "${token.value}" is not supported`);
                        }
                        break;
                    }
                case "minute":
                    {
                        const value = utc ? date.getUTCMinutes() : date.getMinutes();
                        switch(token.value){
                            case "numeric":
                                {
                                    string += value;
                                    break;
                                }
                            case "2-digit":
                                {
                                    string += digits(value, 2);
                                    break;
                                }
                            default:
                                throw Error(`FormatterError: value "${token.value}" is not supported`);
                        }
                        break;
                    }
                case "second":
                    {
                        const value = utc ? date.getUTCSeconds() : date.getSeconds();
                        switch(token.value){
                            case "numeric":
                                {
                                    string += value;
                                    break;
                                }
                            case "2-digit":
                                {
                                    string += digits(value, 2);
                                    break;
                                }
                            default:
                                throw Error(`FormatterError: value "${token.value}" is not supported`);
                        }
                        break;
                    }
                case "fractionalSecond":
                    {
                        const value = utc ? date.getUTCMilliseconds() : date.getMilliseconds();
                        string += digits(value, Number(token.value));
                        break;
                    }
                case "timeZoneName":
                    {
                        break;
                    }
                case "dayPeriod":
                    {
                        string += token.value ? date.getHours() >= 12 ? "PM" : "AM" : "";
                        break;
                    }
                case "literal":
                    {
                        string += token.value;
                        break;
                    }
                default:
                    throw Error(`FormatterError: { ${token.type} ${token.value} }`);
            }
        }
        return string;
    }
    parseToParts(string) {
        const parts = [];
        for (const token of this.#format){
            const type = token.type;
            let value = "";
            switch(token.type){
                case "year":
                    {
                        switch(token.value){
                            case "numeric":
                                {
                                    value = /^\d{1,4}/.exec(string)?.[0];
                                    break;
                                }
                            case "2-digit":
                                {
                                    value = /^\d{1,2}/.exec(string)?.[0];
                                    break;
                                }
                        }
                        break;
                    }
                case "month":
                    {
                        switch(token.value){
                            case "numeric":
                                {
                                    value = /^\d{1,2}/.exec(string)?.[0];
                                    break;
                                }
                            case "2-digit":
                                {
                                    value = /^\d{2}/.exec(string)?.[0];
                                    break;
                                }
                            case "narrow":
                                {
                                    value = /^[a-zA-Z]+/.exec(string)?.[0];
                                    break;
                                }
                            case "short":
                                {
                                    value = /^[a-zA-Z]+/.exec(string)?.[0];
                                    break;
                                }
                            case "long":
                                {
                                    value = /^[a-zA-Z]+/.exec(string)?.[0];
                                    break;
                                }
                            default:
                                throw Error(`ParserError: value "${token.value}" is not supported`);
                        }
                        break;
                    }
                case "day":
                    {
                        switch(token.value){
                            case "numeric":
                                {
                                    value = /^\d{1,2}/.exec(string)?.[0];
                                    break;
                                }
                            case "2-digit":
                                {
                                    value = /^\d{2}/.exec(string)?.[0];
                                    break;
                                }
                            default:
                                throw Error(`ParserError: value "${token.value}" is not supported`);
                        }
                        break;
                    }
                case "hour":
                    {
                        switch(token.value){
                            case "numeric":
                                {
                                    value = /^\d{1,2}/.exec(string)?.[0];
                                    if (token.hour12 && parseInt(value) > 12) {
                                        console.error(`Trying to parse hour greater than 12. Use 'H' instead of 'h'.`);
                                    }
                                    break;
                                }
                            case "2-digit":
                                {
                                    value = /^\d{2}/.exec(string)?.[0];
                                    if (token.hour12 && parseInt(value) > 12) {
                                        console.error(`Trying to parse hour greater than 12. Use 'HH' instead of 'hh'.`);
                                    }
                                    break;
                                }
                            default:
                                throw Error(`ParserError: value "${token.value}" is not supported`);
                        }
                        break;
                    }
                case "minute":
                    {
                        switch(token.value){
                            case "numeric":
                                {
                                    value = /^\d{1,2}/.exec(string)?.[0];
                                    break;
                                }
                            case "2-digit":
                                {
                                    value = /^\d{2}/.exec(string)?.[0];
                                    break;
                                }
                            default:
                                throw Error(`ParserError: value "${token.value}" is not supported`);
                        }
                        break;
                    }
                case "second":
                    {
                        switch(token.value){
                            case "numeric":
                                {
                                    value = /^\d{1,2}/.exec(string)?.[0];
                                    break;
                                }
                            case "2-digit":
                                {
                                    value = /^\d{2}/.exec(string)?.[0];
                                    break;
                                }
                            default:
                                throw Error(`ParserError: value "${token.value}" is not supported`);
                        }
                        break;
                    }
                case "fractionalSecond":
                    {
                        value = new RegExp(`^\\d{${token.value}}`).exec(string)?.[0];
                        break;
                    }
                case "timeZoneName":
                    {
                        value = token.value;
                        break;
                    }
                case "dayPeriod":
                    {
                        value = /^(A|P)M/.exec(string)?.[0];
                        break;
                    }
                case "literal":
                    {
                        if (!string.startsWith(token.value)) {
                            throw Error(`Literal "${token.value}" not found "${string.slice(0, 25)}"`);
                        }
                        value = token.value;
                        break;
                    }
                default:
                    throw Error(`${token.type} ${token.value}`);
            }
            if (!value) {
                throw Error(`value not valid for token { ${type} ${value} } ${string.slice(0, 25)}`);
            }
            parts.push({
                type,
                value
            });
            string = string.slice(value.length);
        }
        if (string.length) {
            throw Error(`datetime string was not fully parsed! ${string.slice(0, 25)}`);
        }
        return parts;
    }
    sortDateTimeFormatPart(parts) {
        let result = [];
        const typeArray = [
            "year",
            "month",
            "day",
            "hour",
            "minute",
            "second",
            "fractionalSecond", 
        ];
        for (const type of typeArray){
            const current = parts.findIndex((el)=>el.type === type
            );
            if (current !== -1) {
                result = result.concat(parts.splice(current, 1));
            }
        }
        result = result.concat(parts);
        return result;
    }
    partsToDate(parts) {
        const date = new Date();
        const utc = parts.find((part)=>part.type === "timeZoneName" && part.value === "UTC"
        );
        utc ? date.setUTCHours(0, 0, 0, 0) : date.setHours(0, 0, 0, 0);
        for (const part of parts){
            switch(part.type){
                case "year":
                    {
                        const value = Number(part.value.padStart(4, "20"));
                        utc ? date.setUTCFullYear(value) : date.setFullYear(value);
                        break;
                    }
                case "month":
                    {
                        const value = Number(part.value) - 1;
                        utc ? date.setUTCMonth(value) : date.setMonth(value);
                        break;
                    }
                case "day":
                    {
                        const value = Number(part.value);
                        utc ? date.setUTCDate(value) : date.setDate(value);
                        break;
                    }
                case "hour":
                    {
                        let value = Number(part.value);
                        const dayPeriod = parts.find((part1)=>part1.type === "dayPeriod"
                        );
                        if (dayPeriod?.value === "PM") value += 12;
                        utc ? date.setUTCHours(value) : date.setHours(value);
                        break;
                    }
                case "minute":
                    {
                        const value = Number(part.value);
                        utc ? date.setUTCMinutes(value) : date.setMinutes(value);
                        break;
                    }
                case "second":
                    {
                        const value = Number(part.value);
                        utc ? date.setUTCSeconds(value) : date.setSeconds(value);
                        break;
                    }
                case "fractionalSecond":
                    {
                        const value = Number(part.value);
                        utc ? date.setUTCMilliseconds(value) : date.setMilliseconds(value);
                        break;
                    }
            }
        }
        return date;
    }
    parse(string) {
        const parts = this.parseToParts(string);
        const sortParts = this.sortDateTimeFormatPart(parts);
        return this.partsToDate(sortParts);
    }
}
const MINUTE = 1000 * 60;
const HOUR = MINUTE * 60;
const DAY = HOUR * 24;
const WEEK = DAY * 7;
var Day;
(function(Day1) {
    Day1[Day1["Sun"] = 0] = "Sun";
    Day1[Day1["Mon"] = 1] = "Mon";
    Day1[Day1["Tue"] = 2] = "Tue";
    Day1[Day1["Wed"] = 3] = "Wed";
    Day1[Day1["Thu"] = 4] = "Thu";
    Day1[Day1["Fri"] = 5] = "Fri";
    Day1[Day1["Sat"] = 6] = "Sat";
})(Day || (Day = {
}));
function toIMF(date) {
    function dtPad(v, lPad = 2) {
        return v.padStart(lPad, "0");
    }
    const d = dtPad(date.getUTCDate().toString());
    const h = dtPad(date.getUTCHours().toString());
    const min = dtPad(date.getUTCMinutes().toString());
    const s = dtPad(date.getUTCSeconds().toString());
    const y = date.getUTCFullYear();
    const days = [
        "Sun",
        "Mon",
        "Tue",
        "Wed",
        "Thu",
        "Fri",
        "Sat"
    ];
    const months = [
        "Jan",
        "Feb",
        "Mar",
        "Apr",
        "May",
        "Jun",
        "Jul",
        "Aug",
        "Sep",
        "Oct",
        "Nov",
        "Dec", 
    ];
    return `${days[date.getUTCDay()]}, ${d} ${months[date.getUTCMonth()]} ${y} ${h}:${min}:${s} GMT`;
}
function calculateMonthsDifference(bigger, smaller) {
    const biggerDate = new Date(bigger);
    const smallerDate = new Date(smaller);
    const yearsDiff = biggerDate.getFullYear() - smallerDate.getFullYear();
    const monthsDiff = biggerDate.getMonth() - smallerDate.getMonth();
    const calendarDifferences = Math.abs(yearsDiff * 12 + monthsDiff);
    const compareResult = biggerDate > smallerDate ? 1 : -1;
    biggerDate.setMonth(biggerDate.getMonth() - compareResult * calendarDifferences);
    const isLastMonthNotFull = biggerDate > smallerDate ? 1 : -1 === -compareResult ? 1 : 0;
    const months = compareResult * (calendarDifferences - isLastMonthNotFull);
    return months === 0 ? 0 : months;
}
const FIELD_CONTENT_REGEXP = /^(?=[\x20-\x7E]*$)[^()@<>,;:\\"\[\]?={}\s]+$/;
function validateCookieName(name) {
    if (name && !FIELD_CONTENT_REGEXP.test(name)) {
        throw new TypeError(`Invalid cookie name: "${name}".`);
    }
}
function validatePath(path) {
    if (path == null) {
        return;
    }
    for(let i2 = 0; i2 < path.length; i2++){
        const c = path.charAt(i2);
        if (c < String.fromCharCode(32) || c > String.fromCharCode(126) || c == ";") {
            throw new Error(path + ": Invalid cookie path char '" + c + "'");
        }
    }
}
function validateCookieValue(name, value) {
    if (value == null || name == null) return;
    for(let i2 = 0; i2 < value.length; i2++){
        const c = value.charAt(i2);
        if (c < String.fromCharCode(33) || c == String.fromCharCode(34) || c == String.fromCharCode(44) || c == String.fromCharCode(59) || c == String.fromCharCode(92) || c == String.fromCharCode(127)) {
            throw new Error("RFC2616 cookie '" + name + "' cannot have '" + c + "' as value");
        }
        if (c > String.fromCharCode(128)) {
            throw new Error("RFC2616 cookie '" + name + "' can only have US-ASCII chars as value" + c.charCodeAt(0).toString(16));
        }
    }
}
function getCookies(req) {
    const cookie = req.headers.get("Cookie");
    if (cookie != null) {
        const out = {
        };
        const c = cookie.split(";");
        for (const kv of c){
            const [cookieKey, ...cookieVal] = kv.split("=");
            assert(cookieKey != null);
            const key7 = cookieKey.trim();
            out[key7] = cookieVal.join("=");
        }
        return out;
    }
    return {
    };
}
const getToken = (request)=>{
    const cookies = getCookies(request);
    return cookies.token;
};
const verifyIssuer = (payload)=>{
    if (payload.iss === "https://accounts.google.com" || payload.iss === "accounts.google.com") {
        return payload;
    }
    throw new Error(`Could not verify issuer (${payload.iss})`);
};
const verifyAudience = (clientId)=>(payload)=>{
        if (payload.aud === clientId) {
            return payload;
        }
        throw new Error(`Could not verify audience / client id (${payload.aud})`);
    }
;
const verifyExpiry = (payload)=>{
    if (payload.exp && payload.exp > Date.now() / 1000) {
        return payload;
    }
    throw new Error(`Token has expired (${payload.exp})`);
};
const getUserIdFromPayload = ({ sub  })=>{
    if (sub) return sub;
    throw new Error("`sub` claim not found in payload");
};
const ifEquals = (condition, ifValueOrFn, elseValueOrFn)=>(input)=>{
        if (input === condition) {
            return typeof ifValueOrFn === "function" ? ifValueOrFn(input) : ifValueOrFn;
        } else {
            return typeof elseValueOrFn === "function" ? elseValueOrFn(input) : elseValueOrFn;
        }
    }
;
const getServerActionLister = (getUserId, getUserActions)=>(request)=>Promise.resolve(request).then(getUserId).then(ifEquals(undefined, [], getUserActions))
;
const getServerActionSaver = (getUserId, saveUserActions)=>(actions, { request  })=>{
        return Promise.resolve(request).then(getUserId).then(ifEquals(undefined, ()=>{
            throw new Error(`User not logged in`);
        }, saveUserActions(actions)));
    }
;
const jwks = [
    {
        "alg": "RS256",
        "kty": "RSA",
        "use": "sig",
        "e": "AQAB",
        "n": "8Yb9hQAJroV6VKCsZZ6ylhVJqo0gsFa0Ca8ytzanKKWsCjo6RaqLjej7QKniTKwhUheCvbfLUqY9Mc6iMbA3gI-6_2lLQbbxExt6WUpf-CAEv1oUcnH_jA6X5Bdu4TdUX29s3D8J95d0eR8z8J1pe-7CjTBClx7lZd5xSRcoDXHDhzkwvc-EehYV46FsJyZCthLpAXvj81gpfycveavNFBMj-nlHKopZvhMcwbsK5JZ37wn2SxFigpfmIojheFVShJsNmLErHVC9HoHTC0iMibsKdyo7mk5QNM_rdBK-KjJhlQr8l7CktAqUJIQzkW8qC7tV7Hl0xicp6ylWZ-pj-Q",
        "kid": "783ec031c59e11f257d0ec15714ef607ce6a2a6f"
    },
    {
        "alg": "RS256",
        "kid": "eea1b1f42807a8cc136a03a3c16d29db8296daf0",
        "e": "AQAB",
        "n": "0zNdxOgV5VIpoeAfj8TMEGRBFg-gaZWz94ePR1yxTKzScHakH4F4wcMEyL0vNE-yW_u4pOl9E-hAalPa2tFv4fCVNMMkmKwcf0gm9wNFWXGakVQ8wER4iUg33MyUGOWj2RGX1zlZxCdFoZRtshLx8xcpL3F5Hlh6m8MqIAowWtusTf5TtYMXFlPaWLQgRXvoOlLZ-muzEuutsZRu-agdOptnUiAZ74e8BgaKN8KNEZ2SqP6vE4w16mgGHQjEPUKz9exxcsnbLru6hZdTDvXbX9IduabyvHy8vQRZsqlE9lTiOOOC9jwh27TXsD05HAXmNYiR6voekzEvfS88vnot2Q",
        "use": "sig",
        "kty": "RSA"
    }, 
];
const clientId = "407408718192.apps.googleusercontent.com";
const userActionsGetter = async (userId)=>{
    return ACTIONS.get(userId, "json");
};
const userActionsSaver = (actions)=>async (userId)=>{
        await ACTIONS.put(userId, JSON.stringify(actions));
    }
;
const pad1 = (nr)=>nr.toString().padStart(2, "0")
;
const format1 = (d)=>`${d.getFullYear()}-${pad1(d.getMonth() + 1)}-${pad1(d.getDate())}`
;
const formatDM = (d, m)=>`${new Date().getFullYear()}-${pad1(m)}-${pad1(d)}`
;
const sundayDate = ()=>{
    const d = new Date();
    d.setDate(d.getDate() + (7 - (d.getDay() || 7)));
    return d;
};
const today = ()=>format1(new Date())
;
const sunday = ()=>format1(sundayDate())
;
const thisMonday = ()=>{
    const d = sundayDate();
    d.setDate(d.getDate() - 6);
    return format1(d);
};
const parseDate = (dateStr)=>{
    switch(dateStr.toLowerCase()){
        case "l":
            return "later";
        case "s":
            return "someday";
        case "today":
        case "t":
            return format1(new Date());
        case "tomorrow":
        case "tm":
            {
                const d = new Date();
                d.setDate(new Date().getDate() + 1);
                return format1(d);
            }
        case "this week":
        case "tw":
            return format1(sundayDate());
        case "next week":
        case "nw":
            {
                const d = sundayDate();
                d.setDate(d.getDate() + 7);
                return format1(d);
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
class RawBinary extends Uint8Array {
    hex() {
        return [
            ...this
        ].map((x)=>x.toString(16).padStart(2, "0")
        ).join("");
    }
    binary() {
        return this;
    }
    base64() {
        return btoa(String.fromCharCode.apply(null, [
            ...this
        ]));
    }
    base64url() {
        let a = btoa(String.fromCharCode.apply(null, [
            ...this
        ])).replace(/=/g, "");
        a = a.replace(/\+/g, "-");
        a = a.replace(/\//g, "_");
        return a;
    }
    base32() {
        const lookup = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
        const trim = [
            0,
            1,
            3,
            7,
            15,
            31,
            63,
            127,
            255
        ];
        let output = "";
        let bits3 = 0;
        let current = 0;
        for(let i2 = 0; i2 < this.length; i2++){
            current = (current << 8) + this[i2];
            bits3 += 8;
            while(bits3 >= 5){
                bits3 -= 5;
                output += lookup[current >> bits3];
                current = current & trim[bits3];
            }
        }
        if (bits3 > 0) {
            output += lookup[current << 5 - bits3];
        }
        return output;
    }
    toString() {
        return new TextDecoder().decode(this);
    }
}
const lookup = [];
const revLookup = [];
const code = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
for(let i2 = 0, l = code.length; i2 < l; ++i2){
    lookup[i2] = code[i2];
    revLookup[code.charCodeAt(i2)] = i2;
}
revLookup["-".charCodeAt(0)] = 62;
revLookup["_".charCodeAt(0)] = 63;
const decoder1 = new TextDecoder();
const encoder1 = new TextEncoder();
function toHexString(buf) {
    return buf.reduce((hex, byte)=>`${hex}${byte < 16 ? "0" : ""}${byte.toString(16)}`
    , "");
}
function fromHexString(hex) {
    const len = hex.length;
    if (len % 2 || !/^[0-9a-fA-F]+$/.test(hex)) {
        throw new TypeError("Invalid hex string.");
    }
    hex = hex.toLowerCase();
    const buf = new Uint8Array(Math.floor(len / 2));
    const end = len / 2;
    for(let i3 = 0; i3 < end; ++i3){
        buf[i3] = parseInt(hex.substr(i3 * 2, 2), 16);
    }
    return buf;
}
function digestLength(algorithm) {
    if (algorithm === "sha512") return 64;
    if (algorithm === "sha256") return 32;
    return 20;
}
function xor(a, b) {
    const c = new Uint8Array(a.length);
    for(let i3 = 0; i3 < c.length; i3++){
        c[i3] = a[i3] ^ b[i3 % b.length];
    }
    return c;
}
function concat(...arg) {
    const length = arg.reduce((a, b)=>a + b.length
    , 0);
    const c = new Uint8Array(length);
    let ptr = 0;
    for(let i3 = 0; i3 < arg.length; i3++){
        c.set(arg[i3], ptr);
        ptr += arg[i3].length;
    }
    return c;
}
function random_bytes(length) {
    const n = new Uint8Array(length);
    for(let i3 = 0; i3 < length; i3++)n[i3] = (Math.random() * 254 | 0) + 1;
    return n;
}
function get_key_size(n) {
    const size_list = [
        64n,
        128n,
        256n,
        512n,
        1024n
    ];
    for (const size of size_list){
        if (n < 1n << size * 8n) return Number(size);
    }
    return 2048;
}
function base64_to_binary(b) {
    let binaryString = window.atob(b);
    let len = binaryString.length;
    let bytes = new Uint8Array(len);
    for(var i3 = 0; i3 < len; i3++){
        bytes[i3] = binaryString.charCodeAt(i3);
    }
    return bytes;
}
function bytesToUuid(bytes) {
    const bits3 = [
        ...bytes
    ].map((bit)=>{
        const s = bit.toString(16);
        return bit < 16 ? "0" + s : s;
    });
    return [
        ...bits3.slice(0, 4),
        "-",
        ...bits3.slice(4, 6),
        "-",
        ...bits3.slice(6, 8),
        "-",
        ...bits3.slice(8, 10),
        "-",
        ...bits3.slice(10, 16), 
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
    for(let i3 = 0; i3 < str.length; i3++){
        bytes[i3] = str.charCodeAt(i3);
    }
    return bytes;
}
function createBuffer(content) {
    const arrayBuffer = new ArrayBuffer(content.length);
    const uint8Array = new Uint8Array(arrayBuffer);
    for(let i3 = 0; i3 < content.length; i3++){
        uint8Array[i3] = content[i3];
    }
    return arrayBuffer;
}
function i2osp(x, length) {
    const t = new Uint8Array(length);
    for(let i3 = length - 1; i3 >= 0; i3--){
        if (x === 0n) break;
        t[i3] = Number(x & 255n);
        x = x >> 8n;
    }
    return t;
}
function os2ip(m) {
    let n = 0n;
    for (const c of m)n = (n << 8n) + BigInt(c);
    return n;
}
function ber_integer(bytes, from, length) {
    let n = 0n;
    for (const b of bytes.slice(from, from + length)){
        n = (n << 8n) + BigInt(b);
    }
    return n;
}
function ber_oid(bytes, from, length) {
    const id = [
        bytes[from] / 40 | 0,
        bytes[from] % 40
    ];
    let value = 0;
    for (const b of bytes.slice(from + 1, from + length)){
        if (b > 128) value += value * 127 + (b - 128);
        else {
            value = value * 128 + b;
            id.push(value);
            value = 0;
        }
    }
    return id.join(".");
}
function ber_unknown(bytes, from, length) {
    return bytes.slice(from, from + length);
}
function ber_simple(n) {
    if (Array.isArray(n.value)) return n.value.map((x)=>ber_simple(x)
    );
    return n.value;
}
const decoder2 = new TextDecoder();
const encoder2 = new TextEncoder();
function toHexString1(buf) {
    return buf.reduce((hex, byte)=>`${hex}${byte < 16 ? "0" : ""}${byte.toString(16)}`
    , "");
}
function fromHexString1(hex) {
    const len = hex.length;
    if (len % 2 || !/^[0-9a-fA-F]+$/.test(hex)) {
        throw new TypeError("Invalid hex string.");
    }
    hex = hex.toLowerCase();
    const buf = new Uint8Array(Math.floor(len / 2));
    const end = len / 2;
    for(let i3 = 0; i3 < end; ++i3){
        buf[i3] = parseInt(hex.substr(i3 * 2, 2), 16);
    }
    return buf;
}
function rotl(x, n) {
    return x << n | x >>> 32 - n;
}
class RawBinary1 extends Uint8Array {
    hex() {
        return [
            ...this
        ].map((x)=>x.toString(16).padStart(2, "0")
        ).join("");
    }
    binary() {
        return this;
    }
    base64() {
        return btoa(String.fromCharCode.apply(null, [
            ...this
        ]));
    }
    base64url() {
        let a = btoa(String.fromCharCode.apply(null, [
            ...this
        ])).replace(/=/g, "");
        a = a.replace(/\+/g, "-");
        a = a.replace(/\//g, "_");
        return a;
    }
    base32() {
        const lookup1 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
        const trim = [
            0,
            1,
            3,
            7,
            15,
            31,
            63,
            127,
            255
        ];
        let output = "";
        let bits3 = 0;
        let current = 0;
        for(let i3 = 0; i3 < this.length; i3++){
            current = (current << 8) + this[i3];
            bits3 += 8;
            while(bits3 >= 5){
                bits3 -= 5;
                output += lookup1[current >> bits3];
                current = current & trim[bits3];
            }
        }
        if (bits3 > 0) {
            output += lookup1[current << 5 - bits3];
        }
        return output;
    }
    toString() {
        return new TextDecoder().decode(this);
    }
}
function i2osp1(x, length) {
    const t = new Uint8Array(length);
    for(let i3 = length - 1; i3 >= 0; i3--){
        if (x === 0n) break;
        t[i3] = Number(x & 255n);
        x = x >> 8n;
    }
    return t;
}
function os2ip1(m) {
    let n = 0n;
    for (const c of m)n = (n << 8n) + BigInt(c);
    return n;
}
function xor1(a, b) {
    const c = new Uint8Array(a.length);
    for(let i3 = 0; i3 < c.length; i3++){
        c[i3] = a[i3] ^ b[i3 % b.length];
    }
    return c;
}
function concat1(...arg) {
    const length = arg.reduce((a, b)=>a + b.length
    , 0);
    const c = new Uint8Array(length);
    let ptr = 0;
    for(let i3 = 0; i3 < arg.length; i3++){
        c.set(arg[i3], ptr);
        ptr += arg[i3].length;
    }
    return c;
}
function random_bytes1(length) {
    const n = new Uint8Array(length);
    for(let i3 = 0; i3 < length; i3++)n[i3] = (Math.random() * 254 | 0) + 1;
    return n;
}
function get_key_size1(n) {
    const size_list = [
        64n,
        128n,
        256n,
        512n,
        1024n
    ];
    for (const size of size_list){
        if (n < 1n << size * 8n) return Number(size);
    }
    return 2048;
}
function base64_to_binary1(b) {
    let binaryString = window.atob(b);
    let len = binaryString.length;
    let bytes = new Uint8Array(len);
    for(var i3 = 0; i3 < len; i3++){
        bytes[i3] = binaryString.charCodeAt(i3);
    }
    return bytes;
}
function ber_integer1(bytes, from, length) {
    let n = 0n;
    for (const b of bytes.slice(from, from + length)){
        n = (n << 8n) + BigInt(b);
    }
    return n;
}
function ber_oid1(bytes, from, length) {
    const id = [
        bytes[from] / 40 | 0,
        bytes[from] % 40
    ];
    let value = 0;
    for (const b of bytes.slice(from + 1, from + length)){
        if (b > 128) value += value * 127 + (b - 128);
        else {
            value = value * 128 + b;
            id.push(value);
            value = 0;
        }
    }
    return id.join(".");
}
function ber_unknown1(bytes, from, length) {
    return bytes.slice(from, from + length);
}
function ber_simple1(n) {
    if (Array.isArray(n.value)) return n.value.map((x)=>ber_simple1(x)
    );
    return n.value;
}
class encode1 {
    static hex(data) {
        if (data.length % 2 !== 0) throw "Invalid hex format";
        const output = new RawBinary1(data.length >> 1);
        let ptr = 0;
        for(let i3 = 0; i3 < data.length; i3 += 2){
            output[ptr++] = parseInt(data.substr(i3, 2), 16);
        }
        return output;
    }
    static bigint(n) {
        const bytes = [];
        while(n > 0){
            bytes.push(Number(n & 255n));
            n = n >> 8n;
        }
        bytes.reverse();
        return new RawBinary1(bytes);
    }
    static string(data) {
        return new RawBinary1(new TextEncoder().encode(data));
    }
    static base64(data) {
        return new RawBinary1(Uint8Array.from(atob(data), (c)=>c.charCodeAt(0)
        ));
    }
    static base64url(data) {
        let input = data.replace(/-/g, "+").replace(/_/g, "/");
        const pad2 = input.length % 4;
        if (pad2) {
            if (pad2 === 1) throw "Invalid length";
            input += new Array(5 - pad2).join("=");
        }
        return encode1.base64(input);
    }
    static binary(data) {
        return new RawBinary1(data);
    }
    static base32(data) {
        data = data.toUpperCase();
        data = data.replace(/=+$/g, "");
        const lookup1 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
        const size = data.length * 5 >> 3;
        const output = new RawBinary1(size);
        let ptr = 0;
        let bits3 = 0;
        let current = 0;
        for(let i3 = 0; i3 < data.length; i3++){
            const value = lookup1.indexOf(data[i3]);
            if (value < 0) throw "Invalid base32 format";
            current = (current << 5) + value;
            bits3 += 5;
            if (bits3 >= 8) {
                bits3 -= 8;
                const t = current >> bits3;
                current -= t << bits3;
                output[ptr++] = t;
            }
        }
        return output;
    }
}
const lookup1 = [];
const revLookup1 = [];
const code1 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
for(let i3 = 0, l1 = code1.length; i3 < l1; ++i3){
    lookup1[i3] = code1[i3];
    revLookup1[code1.charCodeAt(i3)] = i3;
}
function getLengths(b64) {
    const len = b64.length;
    let validLen = b64.indexOf("=");
    if (validLen === -1) {
        validLen = len;
    }
    const placeHoldersLen = validLen === len ? 0 : 4 - validLen % 4;
    return [
        validLen,
        placeHoldersLen
    ];
}
function init(lookup2, revLookup2, urlsafe = false) {
    function _byteLength(validLen, placeHoldersLen) {
        return Math.floor((validLen + placeHoldersLen) * 3 / 4 - placeHoldersLen);
    }
    function tripletToBase64(num) {
        return lookup2[num >> 18 & 63] + lookup2[num >> 12 & 63] + lookup2[num >> 6 & 63] + lookup2[num & 63];
    }
    function encodeChunk(buf, start, end) {
        const out = new Array((end - start) / 3);
        for(let i4 = start, curTriplet = 0; i4 < end; i4 += 3){
            out[curTriplet++] = tripletToBase64((buf[i4] << 16) + (buf[i4 + 1] << 8) + buf[i4 + 2]);
        }
        return out.join("");
    }
    return {
        byteLength (b64) {
            return _byteLength.apply(null, getLengths(b64));
        },
        toUint8Array (b64) {
            const [validLen, placeHoldersLen] = getLengths(b64);
            const buf = new Uint8Array(_byteLength(validLen, placeHoldersLen));
            const len = placeHoldersLen ? validLen - 4 : validLen;
            let tmp;
            let curByte = 0;
            let i4;
            for(i4 = 0; i4 < len; i4 += 4){
                tmp = revLookup2[b64.charCodeAt(i4)] << 18 | revLookup2[b64.charCodeAt(i4 + 1)] << 12 | revLookup2[b64.charCodeAt(i4 + 2)] << 6 | revLookup2[b64.charCodeAt(i4 + 3)];
                buf[curByte++] = tmp >> 16 & 255;
                buf[curByte++] = tmp >> 8 & 255;
                buf[curByte++] = tmp & 255;
            }
            if (placeHoldersLen === 2) {
                tmp = revLookup2[b64.charCodeAt(i4)] << 2 | revLookup2[b64.charCodeAt(i4 + 1)] >> 4;
                buf[curByte++] = tmp & 255;
            } else if (placeHoldersLen === 1) {
                tmp = revLookup2[b64.charCodeAt(i4)] << 10 | revLookup2[b64.charCodeAt(i4 + 1)] << 4 | revLookup2[b64.charCodeAt(i4 + 2)] >> 2;
                buf[curByte++] = tmp >> 8 & 255;
                buf[curByte++] = tmp & 255;
            }
            return buf;
        },
        fromUint8Array (buf) {
            const maxChunkLength = 16383;
            const len = buf.length;
            const extraBytes = len % 3;
            const len2 = len - extraBytes;
            const parts = new Array(Math.ceil(len2 / 16383) + (extraBytes ? 1 : 0));
            let curChunk = 0;
            let chunkEnd;
            for(let i4 = 0; i4 < len2; i4 += 16383){
                chunkEnd = i4 + 16383;
                parts[curChunk++] = encodeChunk(buf, i4, chunkEnd > len2 ? len2 : chunkEnd);
            }
            let tmp;
            if (extraBytes === 1) {
                tmp = buf[len2];
                parts[curChunk] = lookup2[tmp >> 2] + lookup2[tmp << 4 & 63];
                if (!urlsafe) parts[curChunk] += "==";
            } else if (extraBytes === 2) {
                tmp = buf[len2] << 8 | buf[len2 + 1] & 255;
                parts[curChunk] = lookup2[tmp >> 10] + lookup2[tmp >> 4 & 63] + lookup2[tmp << 2 & 63];
                if (!urlsafe) parts[curChunk] += "=";
            }
            return parts.join("");
        }
    };
}
const mod1 = function() {
    const bytesToUuid1 = bytesToUuid;
    const mod2 = function() {
        const UUID_RE = new RegExp("^[0-9a-f]{8}-[0-9a-f]{4}-1[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$", "i");
        function validate(id) {
            return UUID_RE.test(id);
        }
        let _nodeId;
        let _clockseq;
        let _lastMSecs = 0;
        let _lastNSecs = 0;
        function generate(options3, buf, offset) {
            let i4 = buf && offset || 0;
            const b = buf || [];
            options3 = options3 || {
            };
            let node = options3.node || _nodeId;
            let clockseq = options3.clockseq !== undefined ? options3.clockseq : _clockseq;
            if (node == null || clockseq == null) {
                const seedBytes = options3.random || options3.rng || crypto.getRandomValues(new Uint8Array(16));
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
            let msecs = options3.msecs !== undefined ? options3.msecs : new Date().getTime();
            let nsecs = options3.nsecs !== undefined ? options3.nsecs : _lastNSecs + 1;
            const dt1 = msecs - _lastMSecs + (nsecs - _lastNSecs) / 10000;
            if (dt1 < 0 && options3.clockseq === undefined) {
                clockseq = clockseq + 1 & 16383;
            }
            if ((dt1 < 0 || msecs > _lastMSecs) && options3.nsecs === undefined) {
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
            b[i4++] = tl >>> 24 & 255;
            b[i4++] = tl >>> 16 & 255;
            b[i4++] = tl >>> 8 & 255;
            b[i4++] = tl & 255;
            const tmh = msecs / 4294967296 * 10000 & 268435455;
            b[i4++] = tmh >>> 8 & 255;
            b[i4++] = tmh & 255;
            b[i4++] = tmh >>> 24 & 15 | 16;
            b[i4++] = tmh >>> 16 & 255;
            b[i4++] = clockseq >>> 8 | 128;
            b[i4++] = clockseq & 255;
            for(let n = 0; n < 6; ++n){
                b[i4 + n] = node[n];
            }
            return buf ? buf : bytesToUuid(b);
        }
        return {
            validate,
            generate
        };
    }();
    const v1 = mod2;
    const bytesToUuid2 = bytesToUuid;
    const mod3 = function() {
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
    const v4 = mod3;
    const bytesToUuid3 = bytesToUuid;
    const createBuffer1 = createBuffer;
    const stringToBytes1 = stringToBytes;
    const uuidToBytes1 = uuidToBytes;
    const HEX_CHARS2 = "0123456789abcdef".split("");
    const EXTRA2 = [
        -2147483648,
        8388608,
        32768,
        128
    ];
    const SHIFT2 = [
        24,
        16,
        8,
        0
    ];
    const blocks2 = [];
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
        constructor(sharedMemory5 = false){
            this.init(sharedMemory5);
        }
        init(sharedMemory) {
            if (sharedMemory) {
                blocks2[0] = blocks2[16] = blocks2[1] = blocks2[2] = blocks2[3] = blocks2[4] = blocks2[5] = blocks2[6] = blocks2[7] = blocks2[8] = blocks2[9] = blocks2[10] = blocks2[11] = blocks2[12] = blocks2[13] = blocks2[14] = blocks2[15] = 0;
                this.#blocks = blocks2;
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
            const blocks3 = this.#blocks;
            while(index < length){
                let i4;
                if (this.#hashed) {
                    this.#hashed = false;
                    blocks3[0] = this.#block;
                    blocks3[16] = blocks3[1] = blocks3[2] = blocks3[3] = blocks3[4] = blocks3[5] = blocks3[6] = blocks3[7] = blocks3[8] = blocks3[9] = blocks3[10] = blocks3[11] = blocks3[12] = blocks3[13] = blocks3[14] = blocks3[15] = 0;
                }
                if (typeof msg !== "string") {
                    for(i4 = this.#start; index < length && i4 < 64; ++index){
                        blocks3[i4 >> 2] |= msg[index] << SHIFT2[(i4++) & 3];
                    }
                } else {
                    for(i4 = this.#start; index < length && i4 < 64; ++index){
                        let code2 = msg.charCodeAt(index);
                        if (code2 < 128) {
                            blocks3[i4 >> 2] |= code2 << SHIFT2[(i4++) & 3];
                        } else if (code2 < 2048) {
                            blocks3[i4 >> 2] |= (192 | code2 >> 6) << SHIFT2[(i4++) & 3];
                            blocks3[i4 >> 2] |= (128 | code2 & 63) << SHIFT2[(i4++) & 3];
                        } else if (code2 < 55296 || code2 >= 57344) {
                            blocks3[i4 >> 2] |= (224 | code2 >> 12) << SHIFT2[(i4++) & 3];
                            blocks3[i4 >> 2] |= (128 | code2 >> 6 & 63) << SHIFT2[(i4++) & 3];
                            blocks3[i4 >> 2] |= (128 | code2 & 63) << SHIFT2[(i4++) & 3];
                        } else {
                            code2 = 65536 + ((code2 & 1023) << 10 | msg.charCodeAt(++index) & 1023);
                            blocks3[i4 >> 2] |= (240 | code2 >> 18) << SHIFT2[(i4++) & 3];
                            blocks3[i4 >> 2] |= (128 | code2 >> 12 & 63) << SHIFT2[(i4++) & 3];
                            blocks3[i4 >> 2] |= (128 | code2 >> 6 & 63) << SHIFT2[(i4++) & 3];
                            blocks3[i4 >> 2] |= (128 | code2 & 63) << SHIFT2[(i4++) & 3];
                        }
                    }
                }
                this.#lastByteIndex = i4;
                this.#bytes += i4 - this.#start;
                if (i4 >= 64) {
                    this.#block = blocks3[16];
                    this.#start = i4 - 64;
                    this.hash();
                    this.#hashed = true;
                } else {
                    this.#start = i4;
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
            const blocks3 = this.#blocks;
            const i4 = this.#lastByteIndex;
            blocks3[16] = this.#block;
            blocks3[i4 >> 2] |= EXTRA2[i4 & 3];
            this.#block = blocks3[16];
            if (i4 >= 56) {
                if (!this.#hashed) {
                    this.hash();
                }
                blocks3[0] = this.#block;
                blocks3[16] = blocks3[1] = blocks3[2] = blocks3[3] = blocks3[4] = blocks3[5] = blocks3[6] = blocks3[7] = blocks3[8] = blocks3[9] = blocks3[10] = blocks3[11] = blocks3[12] = blocks3[13] = blocks3[14] = blocks3[15] = 0;
            }
            blocks3[14] = this.#hBytes << 3 | this.#bytes >>> 29;
            blocks3[15] = this.#bytes << 3;
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
            const blocks3 = this.#blocks;
            for(j = 16; j < 80; ++j){
                t = blocks3[j - 3] ^ blocks3[j - 8] ^ blocks3[j - 14] ^ blocks3[j - 16];
                blocks3[j] = t << 1 | t >>> 31;
            }
            for(j = 0; j < 20; j += 5){
                f = b & c | ~b & d;
                t = a << 5 | a >>> 27;
                e = t + f + e + 1518500249 + blocks3[j] >>> 0;
                b = b << 30 | b >>> 2;
                f = a & b | ~a & c;
                t = e << 5 | e >>> 27;
                d = t + f + d + 1518500249 + blocks3[j + 1] >>> 0;
                a = a << 30 | a >>> 2;
                f = e & a | ~e & b;
                t = d << 5 | d >>> 27;
                c = t + f + c + 1518500249 + blocks3[j + 2] >>> 0;
                e = e << 30 | e >>> 2;
                f = d & e | ~d & a;
                t = c << 5 | c >>> 27;
                b = t + f + b + 1518500249 + blocks3[j + 3] >>> 0;
                d = d << 30 | d >>> 2;
                f = c & d | ~c & e;
                t = b << 5 | b >>> 27;
                a = t + f + a + 1518500249 + blocks3[j + 4] >>> 0;
                c = c << 30 | c >>> 2;
            }
            for(; j < 40; j += 5){
                f = b ^ c ^ d;
                t = a << 5 | a >>> 27;
                e = t + f + e + 1859775393 + blocks3[j] >>> 0;
                b = b << 30 | b >>> 2;
                f = a ^ b ^ c;
                t = e << 5 | e >>> 27;
                d = t + f + d + 1859775393 + blocks3[j + 1] >>> 0;
                a = a << 30 | a >>> 2;
                f = e ^ a ^ b;
                t = d << 5 | d >>> 27;
                c = t + f + c + 1859775393 + blocks3[j + 2] >>> 0;
                e = e << 30 | e >>> 2;
                f = d ^ e ^ a;
                t = c << 5 | c >>> 27;
                b = t + f + b + 1859775393 + blocks3[j + 3] >>> 0;
                d = d << 30 | d >>> 2;
                f = c ^ d ^ e;
                t = b << 5 | b >>> 27;
                a = t + f + a + 1859775393 + blocks3[j + 4] >>> 0;
                c = c << 30 | c >>> 2;
            }
            for(; j < 60; j += 5){
                f = b & c | b & d | c & d;
                t = a << 5 | a >>> 27;
                e = t + f + e - 1894007588 + blocks3[j] >>> 0;
                b = b << 30 | b >>> 2;
                f = a & b | a & c | b & c;
                t = e << 5 | e >>> 27;
                d = t + f + d - 1894007588 + blocks3[j + 1] >>> 0;
                a = a << 30 | a >>> 2;
                f = e & a | e & b | a & b;
                t = d << 5 | d >>> 27;
                c = t + f + c - 1894007588 + blocks3[j + 2] >>> 0;
                e = e << 30 | e >>> 2;
                f = d & e | d & a | e & a;
                t = c << 5 | c >>> 27;
                b = t + f + b - 1894007588 + blocks3[j + 3] >>> 0;
                d = d << 30 | d >>> 2;
                f = c & d | c & e | d & e;
                t = b << 5 | b >>> 27;
                a = t + f + a - 1894007588 + blocks3[j + 4] >>> 0;
                c = c << 30 | c >>> 2;
            }
            for(; j < 80; j += 5){
                f = b ^ c ^ d;
                t = a << 5 | a >>> 27;
                e = t + f + e - 899497514 + blocks3[j] >>> 0;
                b = b << 30 | b >>> 2;
                f = a ^ b ^ c;
                t = e << 5 | e >>> 27;
                d = t + f + d - 899497514 + blocks3[j + 1] >>> 0;
                a = a << 30 | a >>> 2;
                f = e ^ a ^ b;
                t = d << 5 | d >>> 27;
                c = t + f + c - 899497514 + blocks3[j + 2] >>> 0;
                e = e << 30 | e >>> 2;
                f = d ^ e ^ a;
                t = c << 5 | c >>> 27;
                b = t + f + b - 899497514 + blocks3[j + 3] >>> 0;
                d = d << 30 | d >>> 2;
                f = c ^ d ^ e;
                t = b << 5 | b >>> 27;
                a = t + f + a - 899497514 + blocks3[j + 4] >>> 0;
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
            return HEX_CHARS2[h0 >> 28 & 15] + HEX_CHARS2[h0 >> 24 & 15] + HEX_CHARS2[h0 >> 20 & 15] + HEX_CHARS2[h0 >> 16 & 15] + HEX_CHARS2[h0 >> 12 & 15] + HEX_CHARS2[h0 >> 8 & 15] + HEX_CHARS2[h0 >> 4 & 15] + HEX_CHARS2[h0 & 15] + HEX_CHARS2[h1 >> 28 & 15] + HEX_CHARS2[h1 >> 24 & 15] + HEX_CHARS2[h1 >> 20 & 15] + HEX_CHARS2[h1 >> 16 & 15] + HEX_CHARS2[h1 >> 12 & 15] + HEX_CHARS2[h1 >> 8 & 15] + HEX_CHARS2[h1 >> 4 & 15] + HEX_CHARS2[h1 & 15] + HEX_CHARS2[h2 >> 28 & 15] + HEX_CHARS2[h2 >> 24 & 15] + HEX_CHARS2[h2 >> 20 & 15] + HEX_CHARS2[h2 >> 16 & 15] + HEX_CHARS2[h2 >> 12 & 15] + HEX_CHARS2[h2 >> 8 & 15] + HEX_CHARS2[h2 >> 4 & 15] + HEX_CHARS2[h2 & 15] + HEX_CHARS2[h3 >> 28 & 15] + HEX_CHARS2[h3 >> 24 & 15] + HEX_CHARS2[h3 >> 20 & 15] + HEX_CHARS2[h3 >> 16 & 15] + HEX_CHARS2[h3 >> 12 & 15] + HEX_CHARS2[h3 >> 8 & 15] + HEX_CHARS2[h3 >> 4 & 15] + HEX_CHARS2[h3 & 15] + HEX_CHARS2[h4 >> 28 & 15] + HEX_CHARS2[h4 >> 24 & 15] + HEX_CHARS2[h4 >> 20 & 15] + HEX_CHARS2[h4 >> 16 & 15] + HEX_CHARS2[h4 >> 12 & 15] + HEX_CHARS2[h4 >> 8 & 15] + HEX_CHARS2[h4 >> 4 & 15] + HEX_CHARS2[h4 & 15];
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
        constructor(secretKey2, sharedMemory6 = false){
            super(sharedMemory6);
            let key7;
            if (typeof secretKey2 === "string") {
                const bytes = [];
                const length = secretKey2.length;
                let index = 0;
                for(let i4 = 0; i4 < length; i4++){
                    let code2 = secretKey2.charCodeAt(i4);
                    if (code2 < 128) {
                        bytes[index++] = code2;
                    } else if (code2 < 2048) {
                        bytes[index++] = 192 | code2 >> 6;
                        bytes[index++] = 128 | code2 & 63;
                    } else if (code2 < 55296 || code2 >= 57344) {
                        bytes[index++] = 224 | code2 >> 12;
                        bytes[index++] = 128 | code2 >> 6 & 63;
                        bytes[index++] = 128 | code2 & 63;
                    } else {
                        code2 = 65536 + ((code2 & 1023) << 10 | secretKey2.charCodeAt(++i4) & 1023);
                        bytes[index++] = 240 | code2 >> 18;
                        bytes[index++] = 128 | code2 >> 12 & 63;
                        bytes[index++] = 128 | code2 >> 6 & 63;
                        bytes[index++] = 128 | code2 & 63;
                    }
                }
                key7 = bytes;
            } else {
                if (secretKey2 instanceof ArrayBuffer) {
                    key7 = new Uint8Array(secretKey2);
                } else {
                    key7 = secretKey2;
                }
            }
            if (key7.length > 64) {
                key7 = new Sha1(true).update(key7).array();
            }
            const oKeyPad2 = [];
            const iKeyPad2 = [];
            for(let i4 = 0; i4 < 64; i4++){
                const b = key7[i4] || 0;
                oKeyPad2[i4] = 92 ^ b;
                iKeyPad2[i4] = 54 ^ b;
            }
            this.update(iKeyPad2);
            this.#oKeyPad = oKeyPad2;
            this.#inner = true;
            this.#sharedMemory = sharedMemory6;
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
    function assert1(expr, msg = "") {
        if (!expr) {
            throw new DenoStdInternalError(msg);
        }
    }
    const DenoStdInternalError1 = DenoStdInternalError;
    const assert2 = assert1;
    const assert3 = assert1;
    const mod4 = function() {
        const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
        function validate(id) {
            return UUID_RE.test(id);
        }
        function generate(options3, buf, offset) {
            const i5 = buf && offset || 0;
            let { value , namespace  } = options3;
            if (typeof value == "string") {
                value = stringToBytes(value);
            }
            if (typeof namespace == "string") {
                namespace = uuidToBytes(namespace);
            }
            assert1(namespace.length === 16, "namespace must be uuid string or an Array of 16 byte values");
            const content = namespace.concat(value);
            const bytes = new Sha1().update(createBuffer(content)).digest();
            bytes[6] = bytes[6] & 15 | 80;
            bytes[8] = bytes[8] & 63 | 128;
            if (buf) {
                for(let idx = 0; idx < 16; ++idx){
                    buf[i5 + idx] = bytes[idx];
                }
            }
            return buf || bytesToUuid(bytes);
        }
        return {
            validate,
            generate
        };
    }();
    const v5 = mod4;
    const NIL_UUID = "00000000-0000-0000-0000-000000000000";
    const NIL_UUID1 = NIL_UUID;
    function isNil(val) {
        return val === NIL_UUID;
    }
    const isNil1 = isNil;
    return {
        NIL_UUID,
        isNil,
        v1: mod2,
        v4: mod3,
        v5: mod4
    };
}();
const processActionInput = (input)=>{
    const action = {
        id: input.id || mod1.v4.generate(),
        body: input.body,
        context: getContext(input.body),
        title: getTitle(input.body),
        date: getDate(parseDate)(input.body),
        tags: getTags(input.body)
    };
    if (input.done) action.done = today();
    return action;
};
const getActionSaver = (getActions, saveActions)=>async (input, event)=>{
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
        return saveActions(actions, event);
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
function rsa_pkcs1_encrypt(bytes, n, e, m) {
    const p = concat([
        0,
        2
    ], random_bytes(bytes - m.length - 3), [
        0
    ], m);
    const msg = os2ip(p);
    const c = rsaep(n, e, msg);
    return i2osp(c, bytes);
}
function rsa_pkcs1_decrypt(key7, c) {
    const em = i2osp(rsadp(key7, os2ip(c)), key7.length);
    if (em[0] !== 0) throw "Decryption error";
    if (em[1] !== 2) throw "Decryption error";
    let psCursor = 2;
    for(; psCursor < em.length; psCursor++){
        if (em[psCursor] === 0) break;
    }
    if (psCursor < 10) throw "Decryption error";
    return em.slice(psCursor + 1);
}
function rsa_pkcs1_sign(bytes, n, d, message, algorithm) {
    const oid = [
        48,
        13,
        6,
        9,
        96,
        134,
        72,
        1,
        101,
        3,
        4,
        2,
        algorithm === "sha512" ? 3 : 1,
        5,
        0, 
    ];
    const der = [
        48,
        message.length + 2 + oid.length,
        ...oid,
        4,
        message.length,
        ...message, 
    ];
    const ps = new Array(bytes - 3 - der.length).fill(255);
    const em = new Uint8Array([
        0,
        1,
        ...ps,
        0,
        ...der
    ]);
    const msg = os2ip(em);
    const c = rsaep(n, d, msg);
    return new RawBinary(i2osp(c, bytes));
}
class CFB {
    static encrypt(m, ciper, blockSize, iv) {
        const output = new Uint8Array(m.length);
        let prev = iv;
        for(let i4 = 0; i4 < m.length; i4 += blockSize){
            prev = xor(m.slice(i4, i4 + blockSize), ciper.encrypt(prev));
            output.set(prev, i4);
        }
        return output;
    }
    static decrypt(m, ciper, blockSize, iv) {
        const output = new Uint8Array(m.length);
        let prev = iv;
        for(let i4 = 0; i4 < m.length; i4 += blockSize){
            const t = m.slice(i4, Math.min(i4 + blockSize, m.length));
            output.set(xor(t, ciper.encrypt(prev)), i4);
            prev = t;
        }
        return output;
    }
}
class CBC {
    static encrypt(m, ciper, blockSize, iv) {
        const output = new Uint8Array(m.length);
        let prev = iv;
        for(let i4 = 0; i4 < m.length; i4 += blockSize){
            prev = ciper.encrypt(xor(m.slice(i4, i4 + blockSize), prev));
            output.set(prev, i4);
        }
        return output;
    }
    static decrypt(m, ciper, blockSize, iv) {
        const output = new Uint8Array(m.length);
        let prev = iv;
        for(let i4 = 0; i4 < m.length; i4 += blockSize){
            const t = m.slice(i4, i4 + blockSize);
            output.set(xor(ciper.decrypt(t), prev), i4);
            prev = t;
        }
        return output;
    }
}
class BlockCiperOperation {
    static encrypt(m, ciper, blockSize, config) {
        const computedConfig = {
            mode: "cbc",
            padding: "pkcs5",
            ...config
        };
        const computedIV = typeof computedConfig.iv === "string" ? new TextEncoder().encode(computedConfig.iv) : computedConfig.iv;
        if (blockSize !== computedIV?.length) throw "Invalid IV size";
        if (computedConfig.mode === "ecb") {
            return ECB.encrypt(pad(m), ciper, 16);
        } else if (computedConfig.mode === "cbc") {
            return CBC.encrypt(pad(m), ciper, 16, computedIV);
        } else if (computedConfig.mode === "cfb") {
            return CFB.encrypt(m, ciper, 16, computedIV);
        } else throw "Not implemented";
    }
    static decrypt(m, ciper, blockSize, config) {
        const computedConfig = {
            mode: "cbc",
            padding: "pkcs5",
            ...config
        };
        const computedIV = typeof computedConfig.iv === "string" ? new TextEncoder().encode(computedConfig.iv) : computedConfig.iv;
        if (blockSize !== computedIV?.length) throw "Invalid IV size";
        let output;
        if (computedConfig.mode === "ecb") {
            output = ECB.decrypt(m, ciper, 16);
        } else if (computedConfig.mode === "cbc") {
            output = CBC.decrypt(m, ciper, 16, computedIV);
        } else if (computedConfig.mode === "cfb") {
            return CFB.decrypt(m, ciper, 16, computedIV);
        } else throw "Not implemented";
        return unpad(output);
    }
}
class PureAES {
    constructor(key7, config2){
        this.ciper = new AESBlockCiper(key7);
        this.config = config2;
    }
    async encrypt(m) {
        return BlockCiperOperation.encrypt(m, this.ciper, 16, this.config);
    }
    async decrypt(m) {
        return BlockCiperOperation.decrypt(m, this.ciper, 16, this.config);
    }
}
class encode2 {
    static hex(data) {
        if (data.length % 2 !== 0) throw "Invalid hex format";
        const output = new RawBinary(data.length >> 1);
        let ptr = 0;
        for(let i4 = 0; i4 < data.length; i4 += 2){
            output[ptr++] = parseInt(data.substr(i4, 2), 16);
        }
        return output;
    }
    static bigint(n) {
        const bytes = [];
        while(n > 0){
            bytes.push(Number(n & 255n));
            n = n >> 8n;
        }
        bytes.reverse();
        return new RawBinary(bytes);
    }
    static string(data) {
        return new RawBinary(new TextEncoder().encode(data));
    }
    static base64(data) {
        return new RawBinary(Uint8Array.from(atob(data), (c)=>c.charCodeAt(0)
        ));
    }
    static base64url(data) {
        let input = data.replace(/-/g, "+").replace(/_/g, "/");
        const pad2 = input.length % 4;
        if (pad2) {
            if (pad2 === 1) throw "Invalid length";
            input += new Array(5 - pad2).join("=");
        }
        return encode2.base64(input);
    }
    static binary(data) {
        return new RawBinary(data);
    }
    static base32(data) {
        data = data.toUpperCase();
        data = data.replace(/=+$/g, "");
        const lookup2 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
        const size = data.length * 5 >> 3;
        const output = new RawBinary(size);
        let ptr = 0;
        let bits3 = 0;
        let current = 0;
        for(let i4 = 0; i4 < data.length; i4++){
            const value = lookup2.indexOf(data[i4]);
            if (value < 0) throw "Invalid base32 format";
            current = (current << 5) + value;
            bits3 += 5;
            if (bits3 >= 8) {
                bits3 -= 8;
                const t = current >> bits3;
                current -= t << bits3;
                output[ptr++] = t;
            }
        }
        return output;
    }
}
function decode1(src) {
    const dst = new Uint8Array(decodedLen(src.length));
    for(let i4 = 0; i4 < dst.length; i4++){
        const a = fromHexChar(src[i4 * 2]);
        const b = fromHexChar(src[i4 * 2 + 1]);
        dst[i4] = a << 4 | b;
    }
    if (src.length % 2 == 1) {
        fromHexChar(src[dst.length * 2]);
        throw errLength();
    }
    return dst;
}
function decodeString(s) {
    return decode1(new TextEncoder().encode(s));
}
function rsa_pkcs1_encrypt1(bytes, n, e, m) {
    const p = concat1([
        0,
        2
    ], random_bytes1(bytes - m.length - 3), [
        0
    ], m);
    const msg = os2ip1(p);
    const c = rsaep1(n, e, msg);
    return i2osp1(c, bytes);
}
function rsa_pkcs1_decrypt1(key8, c) {
    const em = i2osp1(rsadp1(key8, os2ip1(c)), key8.length);
    if (em[0] !== 0) throw "Decryption error";
    if (em[1] !== 2) throw "Decryption error";
    let psCursor = 2;
    for(; psCursor < em.length; psCursor++){
        if (em[psCursor] === 0) break;
    }
    if (psCursor < 10) throw "Decryption error";
    return em.slice(psCursor + 1);
}
function rsa_pkcs1_sign1(bytes, n, d, message) {
    const oid = [
        48,
        13,
        6,
        9,
        96,
        134,
        72,
        1,
        101,
        3,
        4,
        2,
        1,
        5,
        0, 
    ];
    const der = [
        48,
        message.length + 2 + oid.length,
        ...oid,
        4,
        message.length,
        ...message, 
    ];
    const ps = new Array(bytes - 3 - der.length).fill(255);
    const em = new Uint8Array([
        0,
        1,
        ...ps,
        0,
        ...der
    ]);
    const msg = os2ip1(em);
    const c = rsaep1(n, d, msg);
    return new RawBinary1(i2osp1(c, bytes));
}
function rsa_import_jwk(key8) {
    if (typeof key8 !== "object") throw new TypeError("Invalid JWK format");
    if (!key8.n) throw new TypeError("RSA key requires n");
    const n = os2ip1(encode1.base64url(key8.n));
    return {
        e: key8.e ? os2ip1(encode1.base64url(key8.e)) : undefined,
        n: os2ip1(encode1.base64url(key8.n)),
        d: key8.d ? os2ip1(encode1.base64url(key8.d)) : undefined,
        p: key8.p ? os2ip1(encode1.base64url(key8.p)) : undefined,
        q: key8.q ? os2ip1(encode1.base64url(key8.q)) : undefined,
        dp: key8.dp ? os2ip1(encode1.base64url(key8.dp)) : undefined,
        dq: key8.dq ? os2ip1(encode1.base64url(key8.dq)) : undefined,
        qi: key8.qi ? os2ip1(encode1.base64url(key8.qi)) : undefined,
        length: get_key_size1(n)
    };
}
function rsa_export_pkcs8_public(key8) {
    const content = BER1.createSequence([
        BER1.createSequence([
            new Uint8Array([
                6,
                9,
                42,
                134,
                72,
                134,
                247,
                13,
                1,
                1,
                1, 
            ]),
            BER1.createNull(), 
        ]),
        BER1.createBitString(BER1.createSequence([
            BER1.createInteger(key8.n),
            BER1.createInteger(key8.e || 0n), 
        ])), 
    ]);
    return "-----BEGIN PUBLIC KEY-----\n" + add_line_break1(encode1.binary(content).base64()) + "\n-----END PUBLIC KEY-----\n";
}
function rsa_export_pkcs8_private(key8) {
    const content = BER1.createSequence([
        BER1.createInteger(0),
        BER1.createInteger(key8.n),
        BER1.createInteger(key8.e || 0n),
        BER1.createInteger(key8.d || 0n),
        BER1.createInteger(key8.p || 0n),
        BER1.createInteger(key8.q || 0n),
        BER1.createInteger(key8.dp || 0n),
        BER1.createInteger(key8.dq || 0n),
        BER1.createInteger(key8.qi || 0n), 
    ]);
    const ber = encode1.binary(content).base64();
    return "-----BEGIN RSA PRIVATE KEY-----\n" + add_line_break1(ber) + "\n-----END RSA PRIVATE KEY-----\n";
}
class RSAKey {
    constructor(params){
        this.n = params.n;
        this.e = params.e;
        this.d = params.d;
        this.p = params.p;
        this.q = params.q;
        this.dp = params.dp;
        this.dq = params.dq;
        this.qi = params.qi;
        this.length = params.length;
    }
    pem() {
        if (this.d) {
            return rsa_export_pkcs8_private(this);
        } else {
            return rsa_export_pkcs8_public(this);
        }
    }
    jwk() {
        let jwk = {
            kty: "RSA",
            n: encode1.bigint(this.n).base64url()
        };
        if (this.d) jwk = {
            ...jwk,
            d: encode1.bigint(this.d).base64url()
        };
        if (this.e) jwk = {
            ...jwk,
            e: encode1.bigint(this.e).base64url()
        };
        if (this.p) jwk = {
            ...jwk,
            p: encode1.bigint(this.p).base64url()
        };
        if (this.q) jwk = {
            ...jwk,
            q: encode1.bigint(this.q).base64url()
        };
        if (this.dp) jwk = {
            ...jwk,
            dp: encode1.bigint(this.dp).base64url()
        };
        if (this.dq) jwk = {
            ...jwk,
            dq: encode1.bigint(this.dq).base64url()
        };
        if (this.qi) jwk = {
            ...jwk,
            qi: encode1.bigint(this.qi).base64url()
        };
        return jwk;
    }
}
function convertHexToBase64url(input) {
    return mod.encode(decodeString(input));
}
function toString(cookie) {
    if (!cookie.name) {
        return "";
    }
    const out = [];
    validateCookieName(cookie.name);
    validateCookieValue(cookie.name, cookie.value);
    out.push(`${cookie.name}=${cookie.value}`);
    if (cookie.name.startsWith("__Secure")) {
        cookie.secure = true;
    }
    if (cookie.name.startsWith("__Host")) {
        cookie.path = "/";
        cookie.secure = true;
        delete cookie.domain;
    }
    if (cookie.secure) {
        out.push("Secure");
    }
    if (cookie.httpOnly) {
        out.push("HttpOnly");
    }
    if (typeof cookie.maxAge === "number" && Number.isInteger(cookie.maxAge)) {
        assert(cookie.maxAge > 0, "Max-Age must be an integer superior to 0");
        out.push(`Max-Age=${cookie.maxAge}`);
    }
    if (cookie.domain) {
        out.push(`Domain=${cookie.domain}`);
    }
    if (cookie.sameSite) {
        out.push(`SameSite=${cookie.sameSite}`);
    }
    if (cookie.path) {
        validatePath(cookie.path);
        out.push(`Path=${cookie.path}`);
    }
    if (cookie.expires) {
        const dateString = toIMF(cookie.expires);
        out.push(`Expires=${dateString}`);
    }
    if (cookie.unparsed) {
        out.push(cookie.unparsed.join("; "));
    }
    return out.join("; ");
}
function setCookie(res, cookie) {
    if (!res.headers) {
        res.headers = new Headers();
    }
    const v = toString(cookie);
    if (v) {
        res.headers.append("Set-Cookie", v);
    }
}
const { byteLength , toUint8Array , fromUint8Array  } = init(lookup, revLookup);
function encode3(str, encoding = "utf8") {
    if (/^utf-?8$/i.test(encoding)) {
        return encoder1.encode(str);
    } else if (/^base64(?:url)?$/i.test(encoding)) {
        return toUint8Array(str);
    } else if (/^hex(?:adecimal)?$/i.test(encoding)) {
        return fromHexString(str);
    } else {
        throw new TypeError("Unsupported string encoding.");
    }
}
const { byteLength: byteLength1 , toUint8Array: toUint8Array1 , fromUint8Array: fromUint8Array1  } = init(lookup1, revLookup1, true);
function rsa_import_jwk1(key8) {
    if (typeof key8 !== "object") throw new TypeError("Invalid JWK format");
    if (!key8.n) throw new TypeError("RSA key requires n");
    const n = os2ip(encode2.base64url(key8.n));
    return {
        e: key8.e ? os2ip(encode2.base64url(key8.e)) : undefined,
        n: os2ip(encode2.base64url(key8.n)),
        d: key8.d ? os2ip(encode2.base64url(key8.d)) : undefined,
        p: key8.p ? os2ip(encode2.base64url(key8.p)) : undefined,
        q: key8.q ? os2ip(encode2.base64url(key8.q)) : undefined,
        dp: key8.dp ? os2ip(encode2.base64url(key8.dp)) : undefined,
        dq: key8.dq ? os2ip(encode2.base64url(key8.dq)) : undefined,
        qi: key8.qi ? os2ip(encode2.base64url(key8.qi)) : undefined,
        length: get_key_size(n)
    };
}
function rsa_export_pkcs8_public1(key8) {
    const content = BER.createSequence([
        BER.createSequence([
            new Uint8Array([
                6,
                9,
                42,
                134,
                72,
                134,
                247,
                13,
                1,
                1,
                1, 
            ]),
            BER.createNull(), 
        ]),
        BER.createBitString(BER.createSequence([
            BER.createInteger(key8.n),
            BER.createInteger(key8.e || 0n), 
        ])), 
    ]);
    return "-----BEGIN PUBLIC KEY-----\n" + add_line_break(encode2.binary(content).base64()) + "\n-----END PUBLIC KEY-----\n";
}
function rsa_export_pkcs8_private1(key8) {
    const content = BER.createSequence([
        BER.createInteger(0),
        BER.createInteger(key8.n),
        BER.createInteger(key8.e || 0n),
        BER.createInteger(key8.d || 0n),
        BER.createInteger(key8.p || 0n),
        BER.createInteger(key8.q || 0n),
        BER.createInteger(key8.dp || 0n),
        BER.createInteger(key8.dq || 0n),
        BER.createInteger(key8.qi || 0n), 
    ]);
    const ber = encode2.binary(content).base64();
    return "-----BEGIN RSA PRIVATE KEY-----\n" + add_line_break(ber) + "\n-----END RSA PRIVATE KEY-----\n";
}
class RSAKey1 {
    constructor(params1){
        this.n = params1.n;
        this.e = params1.e;
        this.d = params1.d;
        this.p = params1.p;
        this.q = params1.q;
        this.dp = params1.dp;
        this.dq = params1.dq;
        this.qi = params1.qi;
        this.length = params1.length;
    }
    pem() {
        if (this.d) {
            return rsa_export_pkcs8_private1(this);
        } else {
            return rsa_export_pkcs8_public1(this);
        }
    }
    jwk() {
        let jwk = {
            kty: "RSA",
            n: encode2.bigint(this.n).base64url()
        };
        if (this.d) jwk = {
            ...jwk,
            d: encode2.bigint(this.d).base64url()
        };
        if (this.e) jwk = {
            ...jwk,
            e: encode2.bigint(this.e).base64url()
        };
        if (this.p) jwk = {
            ...jwk,
            p: encode2.bigint(this.p).base64url()
        };
        if (this.q) jwk = {
            ...jwk,
            q: encode2.bigint(this.q).base64url()
        };
        if (this.dp) jwk = {
            ...jwk,
            dp: encode2.bigint(this.dp).base64url()
        };
        if (this.dq) jwk = {
            ...jwk,
            dq: encode2.bigint(this.dq).base64url()
        };
        if (this.qi) jwk = {
            ...jwk,
            qi: encode2.bigint(this.qi).base64url()
        };
        return jwk;
    }
}
function decode2(buf, encoding = "utf8") {
    if (/^utf-?8$/i.test(encoding)) {
        return decoder1.decode(buf);
    } else if (/^base64$/i.test(encoding)) {
        return fromUint8Array(buf);
    } else if (/^base64url$/i.test(encoding)) {
        return fromUint8Array1(buf);
    } else if (/^hex(?:adecimal)?$/i.test(encoding)) {
        return toHexString(buf);
    } else {
        throw new TypeError("Unsupported string encoding.");
    }
}
class SHA512 {
    hashSize = 64;
    _buffer = new Uint8Array(128);
    constructor(){
        this._K = new Uint32Array([
            1116352408,
            3609767458,
            1899447441,
            602891725,
            3049323471,
            3964484399,
            3921009573,
            2173295548,
            961987163,
            4081628472,
            1508970993,
            3053834265,
            2453635748,
            2937671579,
            2870763221,
            3664609560,
            3624381080,
            2734883394,
            310598401,
            1164996542,
            607225278,
            1323610764,
            1426881987,
            3590304994,
            1925078388,
            4068182383,
            2162078206,
            991336113,
            2614888103,
            633803317,
            3248222580,
            3479774868,
            3835390401,
            2666613458,
            4022224774,
            944711139,
            264347078,
            2341262773,
            604807628,
            2007800933,
            770255983,
            1495990901,
            1249150122,
            1856431235,
            1555081692,
            3175218132,
            1996064986,
            2198950837,
            2554220882,
            3999719339,
            2821834349,
            766784016,
            2952996808,
            2566594879,
            3210313671,
            3203337956,
            3336571891,
            1034457026,
            3584528711,
            2466948901,
            113926993,
            3758326383,
            338241895,
            168717936,
            666307205,
            1188179964,
            773529912,
            1546045734,
            1294757372,
            1522805485,
            1396182291,
            2643833823,
            1695183700,
            2343527390,
            1986661051,
            1014477480,
            2177026350,
            1206759142,
            2456956037,
            344077627,
            2730485921,
            1290863460,
            2820302411,
            3158454273,
            3259730800,
            3505952657,
            3345764771,
            106217008,
            3516065817,
            3606008344,
            3600352804,
            1432725776,
            4094571909,
            1467031594,
            275423344,
            851169720,
            430227734,
            3100823752,
            506948616,
            1363258195,
            659060556,
            3750685593,
            883997877,
            3785050280,
            958139571,
            3318307427,
            1322822218,
            3812723403,
            1537002063,
            2003034995,
            1747873779,
            3602036899,
            1955562222,
            1575990012,
            2024104815,
            1125592928,
            2227730452,
            2716904306,
            2361852424,
            442776044,
            2428436474,
            593698344,
            2756734187,
            3733110249,
            3204031479,
            2999351573,
            3329325298,
            3815920427,
            3391569614,
            3928383900,
            3515267271,
            566280711,
            3940187606,
            3454069534,
            4118630271,
            4000239992,
            116418474,
            1914138554,
            174292421,
            2731055270,
            289380356,
            3203993006,
            460393269,
            320620315,
            685471733,
            587496836,
            852142971,
            1086792851,
            1017036298,
            365543100,
            1126000580,
            2618297676,
            1288033470,
            3409855158,
            1501505948,
            4234509866,
            1607167915,
            987167468,
            1816402316,
            1246189591
        ]);
        this.init();
    }
    init() {
        this._H = new Uint32Array([
            1779033703,
            4089235720,
            3144134277,
            2227873595,
            1013904242,
            4271175723,
            2773480762,
            1595750129,
            1359893119,
            2917565137,
            2600822924,
            725511199,
            528734635,
            4215389547,
            1541459225,
            327033209
        ]);
        this._bufferIndex = 0;
        this._count = new Uint32Array(2);
        this._buffer.fill(0);
        this._finalized = false;
        return this;
    }
    update(msg, inputEncoding) {
        if (msg === null) {
            throw new TypeError("msg must be a string or Uint8Array.");
        } else if (typeof msg === "string") {
            msg = encode3(msg, inputEncoding);
        }
        for(let i4 = 0; i4 < msg.length; i4++){
            this._buffer[this._bufferIndex++] = msg[i4];
            if (this._bufferIndex === 128) {
                this.transform();
                this._bufferIndex = 0;
            }
        }
        let c = this._count;
        if ((c[0] += msg.length << 3) < msg.length << 3) {
            c[1]++;
        }
        c[1] += msg.length >>> 29;
        return this;
    }
    digest(outputEncoding) {
        if (this._finalized) {
            throw new Error("digest has already been called.");
        }
        this._finalized = true;
        var b = this._buffer, idx = this._bufferIndex;
        b[idx++] = 128;
        while(idx !== 112){
            if (idx === 128) {
                this.transform();
                idx = 0;
            }
            b[idx++] = 0;
        }
        let c = this._count;
        b[112] = b[113] = b[114] = b[115] = b[116] = b[117] = b[118] = b[119] = 0;
        b[120] = c[1] >>> 24 & 255;
        b[121] = c[1] >>> 16 & 255;
        b[122] = c[1] >>> 8 & 255;
        b[123] = c[1] >>> 0 & 255;
        b[124] = c[0] >>> 24 & 255;
        b[125] = c[0] >>> 16 & 255;
        b[126] = c[0] >>> 8 & 255;
        b[127] = c[0] >>> 0 & 255;
        this.transform();
        let i4, hash = new Uint8Array(64);
        for(i4 = 0; i4 < 16; i4++){
            hash[(i4 << 2) + 0] = this._H[i4] >>> 24 & 255;
            hash[(i4 << 2) + 1] = this._H[i4] >>> 16 & 255;
            hash[(i4 << 2) + 2] = this._H[i4] >>> 8 & 255;
            hash[(i4 << 2) + 3] = this._H[i4] & 255;
        }
        this.init();
        return outputEncoding ? decode2(hash, outputEncoding) : hash;
    }
    transform() {
        let h = this._H, h0h = h[0], h0l = h[1], h1h = h[2], h1l = h[3], h2h = h[4], h2l = h[5], h3h = h[6], h3l = h[7], h4h = h[8], h4l = h[9], h5h = h[10], h5l = h[11], h6h = h[12], h6l = h[13], h7h = h[14], h7l = h[15];
        let ah = h0h, al = h0l, bh = h1h, bl = h1l, ch = h2h, cl = h2l, dh = h3h, dl = h3l, eh = h4h, el = h4l, fh = h5h, fl = h5l, gh = h6h, gl = h6l, hh = h7h, hl = h7l;
        let i4, w = new Uint32Array(160);
        for(i4 = 0; i4 < 32; i4++){
            w[i4] = this._buffer[(i4 << 2) + 3] | this._buffer[(i4 << 2) + 2] << 8 | this._buffer[(i4 << 2) + 1] << 16 | this._buffer[i4 << 2] << 24;
        }
        let gamma0xl, gamma0xh, gamma0l, gamma0h, gamma1xl, gamma1xh, gamma1l, gamma1h, wrl, wrh, wr7l, wr7h, wr16l, wr16h;
        for(i4 = 16; i4 < 80; i4++){
            gamma0xh = w[(i4 - 15) * 2];
            gamma0xl = w[(i4 - 15) * 2 + 1];
            gamma0h = (gamma0xl << 31 | gamma0xh >>> 1) ^ (gamma0xl << 24 | gamma0xh >>> 8) ^ gamma0xh >>> 7;
            gamma0l = (gamma0xh << 31 | gamma0xl >>> 1) ^ (gamma0xh << 24 | gamma0xl >>> 8) ^ (gamma0xh << 25 | gamma0xl >>> 7);
            gamma1xh = w[(i4 - 2) * 2];
            gamma1xl = w[(i4 - 2) * 2 + 1];
            gamma1h = (gamma1xl << 13 | gamma1xh >>> 19) ^ (gamma1xh << 3 | gamma1xl >>> 29) ^ gamma1xh >>> 6;
            gamma1l = (gamma1xh << 13 | gamma1xl >>> 19) ^ (gamma1xl << 3 | gamma1xh >>> 29) ^ (gamma1xh << 26 | gamma1xl >>> 6);
            wr7h = w[(i4 - 7) * 2], wr7l = w[(i4 - 7) * 2 + 1], wr16h = w[(i4 - 16) * 2], wr16l = w[(i4 - 16) * 2 + 1];
            wrl = gamma0l + wr7l;
            wrh = gamma0h + wr7h + (wrl >>> 0 < gamma0l >>> 0 ? 1 : 0);
            wrl += gamma1l;
            wrh += gamma1h + (wrl >>> 0 < gamma1l >>> 0 ? 1 : 0);
            wrl += wr16l;
            wrh += wr16h + (wrl >>> 0 < wr16l >>> 0 ? 1 : 0);
            w[i4 * 2] = wrh;
            w[i4 * 2 + 1] = wrl;
        }
        let chl, chh, majl, majh, sig0l, sig0h, sig1l, sig1h, krl, krh, t1l, t1h, t2l, t2h;
        for(i4 = 0; i4 < 80; i4++){
            chh = eh & fh ^ ~eh & gh;
            chl = el & fl ^ ~el & gl;
            majh = ah & bh ^ ah & ch ^ bh & ch;
            majl = al & bl ^ al & cl ^ bl & cl;
            sig0h = (al << 4 | ah >>> 28) ^ (ah << 30 | al >>> 2) ^ (ah << 25 | al >>> 7);
            sig0l = (ah << 4 | al >>> 28) ^ (al << 30 | ah >>> 2) ^ (al << 25 | ah >>> 7);
            sig1h = (el << 18 | eh >>> 14) ^ (el << 14 | eh >>> 18) ^ (eh << 23 | el >>> 9);
            sig1l = (eh << 18 | el >>> 14) ^ (eh << 14 | el >>> 18) ^ (el << 23 | eh >>> 9);
            krh = this._K[i4 * 2];
            krl = this._K[i4 * 2 + 1];
            t1l = hl + sig1l;
            t1h = hh + sig1h + (t1l >>> 0 < hl >>> 0 ? 1 : 0);
            t1l += chl;
            t1h += chh + (t1l >>> 0 < chl >>> 0 ? 1 : 0);
            t1l += krl;
            t1h += krh + (t1l >>> 0 < krl >>> 0 ? 1 : 0);
            t1l = t1l + w[i4 * 2 + 1];
            t1h += w[i4 * 2] + (t1l >>> 0 < w[i4 * 2 + 1] >>> 0 ? 1 : 0);
            t2l = sig0l + majl;
            t2h = sig0h + majh + (t2l >>> 0 < sig0l >>> 0 ? 1 : 0);
            hh = gh;
            hl = gl;
            gh = fh;
            gl = fl;
            fh = eh;
            fl = el;
            el = dl + t1l | 0;
            eh = dh + t1h + (el >>> 0 < dl >>> 0 ? 1 : 0) | 0;
            dh = ch;
            dl = cl;
            ch = bh;
            cl = bl;
            bh = ah;
            bl = al;
            al = t1l + t2l | 0;
            ah = t1h + t2h + (al >>> 0 < t1l >>> 0 ? 1 : 0) | 0;
        }
        h0l = h[1] = h0l + al | 0;
        h[0] = h0h + ah + (h0l >>> 0 < al >>> 0 ? 1 : 0) | 0;
        h1l = h[3] = h1l + bl | 0;
        h[2] = h1h + bh + (h1l >>> 0 < bl >>> 0 ? 1 : 0) | 0;
        h2l = h[5] = h2l + cl | 0;
        h[4] = h2h + ch + (h2l >>> 0 < cl >>> 0 ? 1 : 0) | 0;
        h3l = h[7] = h3l + dl | 0;
        h[6] = h3h + dh + (h3l >>> 0 < dl >>> 0 ? 1 : 0) | 0;
        h4l = h[9] = h4l + el | 0;
        h[8] = h4h + eh + (h4l >>> 0 < el >>> 0 ? 1 : 0) | 0;
        h5l = h[11] = h5l + fl | 0;
        h[10] = h5h + fh + (h5l >>> 0 < fl >>> 0 ? 1 : 0) | 0;
        h6l = h[13] = h6l + gl | 0;
        h[12] = h6h + gh + (h6l >>> 0 < gl >>> 0 ? 1 : 0) | 0;
        h7l = h[15] = h7l + hl | 0;
        h[14] = h7h + hh + (h7l >>> 0 < hl >>> 0 ? 1 : 0) | 0;
    }
}
function sha512(msg, inputEncoding, outputEncoding) {
    return new SHA512().init().update(msg, inputEncoding).digest(outputEncoding);
}
function decode3(buf, encoding = "utf8") {
    if (/^utf-?8$/i.test(encoding)) {
        return decoder2.decode(buf);
    } else if (/^base64$/i.test(encoding)) {
        return fromUint8Array1(buf);
    } else if (/^hex(?:adecimal)?$/i.test(encoding)) {
        return toHexString1(buf);
    } else {
        throw new TypeError("Unsupported string encoding.");
    }
}
function encode4(str, encoding = "utf8") {
    if (/^utf-?8$/i.test(encoding)) {
        return encoder2.encode(str);
    } else if (/^base64$/i.test(encoding)) {
        return toUint8Array1(str);
    } else if (/^hex(?:adecimal)?$/i.test(encoding)) {
        return fromHexString1(str);
    } else {
        throw new TypeError("Unsupported string encoding.");
    }
}
class SHA1 {
    hashSize = 20;
    _buf = new Uint8Array(64);
    _K = new Uint32Array([
        1518500249,
        1859775393,
        2400959708,
        3395469782
    ]);
    constructor(){
        this.init();
    }
    static F(t, b, c, d) {
        if (t <= 19) {
            return b & c | ~b & d;
        } else if (t <= 39) {
            return b ^ c ^ d;
        } else if (t <= 59) {
            return b & c | b & d | c & d;
        } else {
            return b ^ c ^ d;
        }
    }
    init() {
        this._H = new Uint32Array([
            1732584193,
            4023233417,
            2562383102,
            271733878,
            3285377520
        ]);
        this._bufIdx = 0;
        this._count = new Uint32Array(2);
        this._buf.fill(0);
        this._finalized = false;
        return this;
    }
    update(msg, inputEncoding) {
        if (msg === null) {
            throw new TypeError("msg must be a string or Uint8Array.");
        } else if (typeof msg === "string") {
            msg = encode4(msg, inputEncoding);
        }
        for(let i4 = 0; i4 < msg.length; i4++){
            this._buf[this._bufIdx++] = msg[i4];
            if (this._bufIdx === 64) {
                this.transform();
                this._bufIdx = 0;
            }
        }
        const c = this._count;
        if ((c[0] += msg.length << 3) < msg.length << 3) {
            c[1]++;
        }
        c[1] += msg.length >>> 29;
        return this;
    }
    digest(outputEncoding) {
        if (this._finalized) {
            throw new Error("digest has already been called.");
        }
        this._finalized = true;
        const b = this._buf;
        let idx = this._bufIdx;
        b[idx++] = 128;
        while(idx !== 56){
            if (idx === 64) {
                this.transform();
                idx = 0;
            }
            b[idx++] = 0;
        }
        const c = this._count;
        b[56] = c[1] >>> 24 & 255;
        b[57] = c[1] >>> 16 & 255;
        b[58] = c[1] >>> 8 & 255;
        b[59] = c[1] >>> 0 & 255;
        b[60] = c[0] >>> 24 & 255;
        b[61] = c[0] >>> 16 & 255;
        b[62] = c[0] >>> 8 & 255;
        b[63] = c[0] >>> 0 & 255;
        this.transform();
        const hash = new Uint8Array(20);
        for(let i4 = 0; i4 < 5; i4++){
            hash[(i4 << 2) + 0] = this._H[i4] >>> 24 & 255;
            hash[(i4 << 2) + 1] = this._H[i4] >>> 16 & 255;
            hash[(i4 << 2) + 2] = this._H[i4] >>> 8 & 255;
            hash[(i4 << 2) + 3] = this._H[i4] >>> 0 & 255;
        }
        this.init();
        return outputEncoding ? decode3(hash, outputEncoding) : hash;
    }
    transform() {
        const h = this._H;
        let a = h[0];
        let b = h[1];
        let c = h[2];
        let d = h[3];
        let e = h[4];
        const w = new Uint32Array(80);
        for(let i4 = 0; i4 < 16; i4++){
            w[i4] = this._buf[(i4 << 2) + 3] | this._buf[(i4 << 2) + 2] << 8 | this._buf[(i4 << 2) + 1] << 16 | this._buf[i4 << 2] << 24;
        }
        for(let t = 0; t < 80; t++){
            if (t >= 16) {
                w[t] = rotl(w[t - 3] ^ w[t - 8] ^ w[t - 14] ^ w[t - 16], 1);
            }
            const tmp = rotl(a, 5) + SHA1.F(t, b, c, d) + e + w[t] + this._K[Math.floor(t / 20)] | 0;
            e = d;
            d = c;
            c = rotl(b, 30);
            b = a;
            a = tmp;
        }
        h[0] = h[0] + a | 0;
        h[1] = h[1] + b | 0;
        h[2] = h[2] + c | 0;
        h[3] = h[3] + d | 0;
        h[4] = h[4] + e | 0;
    }
}
function sha1(msg, inputEncoding, outputEncoding) {
    return new SHA1().update(msg, inputEncoding).digest(outputEncoding);
}
class SHA256 {
    hashSize = 32;
    constructor(){
        this._buf = new Uint8Array(64);
        this._K = new Uint32Array([
            1116352408,
            1899447441,
            3049323471,
            3921009573,
            961987163,
            1508970993,
            2453635748,
            2870763221,
            3624381080,
            310598401,
            607225278,
            1426881987,
            1925078388,
            2162078206,
            2614888103,
            3248222580,
            3835390401,
            4022224774,
            264347078,
            604807628,
            770255983,
            1249150122,
            1555081692,
            1996064986,
            2554220882,
            2821834349,
            2952996808,
            3210313671,
            3336571891,
            3584528711,
            113926993,
            338241895,
            666307205,
            773529912,
            1294757372,
            1396182291,
            1695183700,
            1986661051,
            2177026350,
            2456956037,
            2730485921,
            2820302411,
            3259730800,
            3345764771,
            3516065817,
            3600352804,
            4094571909,
            275423344,
            430227734,
            506948616,
            659060556,
            883997877,
            958139571,
            1322822218,
            1537002063,
            1747873779,
            1955562222,
            2024104815,
            2227730452,
            2361852424,
            2428436474,
            2756734187,
            3204031479,
            3329325298
        ]);
        this.init();
    }
    init() {
        this._H = new Uint32Array([
            1779033703,
            3144134277,
            1013904242,
            2773480762,
            1359893119,
            2600822924,
            528734635,
            1541459225
        ]);
        this._bufIdx = 0;
        this._count = new Uint32Array(2);
        this._buf.fill(0);
        this._finalized = false;
        return this;
    }
    update(msg, inputEncoding) {
        if (msg === null) {
            throw new TypeError("msg must be a string or Uint8Array.");
        } else if (typeof msg === "string") {
            msg = encode4(msg, inputEncoding);
        }
        for(let i4 = 0, len = msg.length; i4 < len; i4++){
            this._buf[this._bufIdx++] = msg[i4];
            if (this._bufIdx === 64) {
                this._transform();
                this._bufIdx = 0;
            }
        }
        const c = this._count;
        if ((c[0] += msg.length << 3) < msg.length << 3) {
            c[1]++;
        }
        c[1] += msg.length >>> 29;
        return this;
    }
    digest(outputEncoding) {
        if (this._finalized) {
            throw new Error("digest has already been called.");
        }
        this._finalized = true;
        const b = this._buf;
        let idx = this._bufIdx;
        b[idx++] = 128;
        while(idx !== 56){
            if (idx === 64) {
                this._transform();
                idx = 0;
            }
            b[idx++] = 0;
        }
        const c = this._count;
        b[56] = c[1] >>> 24 & 255;
        b[57] = c[1] >>> 16 & 255;
        b[58] = c[1] >>> 8 & 255;
        b[59] = c[1] >>> 0 & 255;
        b[60] = c[0] >>> 24 & 255;
        b[61] = c[0] >>> 16 & 255;
        b[62] = c[0] >>> 8 & 255;
        b[63] = c[0] >>> 0 & 255;
        this._transform();
        const hash = new Uint8Array(32);
        for(let i4 = 0; i4 < 8; i4++){
            hash[(i4 << 2) + 0] = this._H[i4] >>> 24 & 255;
            hash[(i4 << 2) + 1] = this._H[i4] >>> 16 & 255;
            hash[(i4 << 2) + 2] = this._H[i4] >>> 8 & 255;
            hash[(i4 << 2) + 3] = this._H[i4] >>> 0 & 255;
        }
        this.init();
        return outputEncoding ? decode3(hash, outputEncoding) : hash;
    }
    _transform() {
        const h = this._H;
        let h0 = h[0];
        let h1 = h[1];
        let h2 = h[2];
        let h3 = h[3];
        let h4 = h[4];
        let h5 = h[5];
        let h6 = h[6];
        let h7 = h[7];
        const w = new Uint32Array(16);
        let i4;
        for(i4 = 0; i4 < 16; i4++){
            w[i4] = this._buf[(i4 << 2) + 3] | this._buf[(i4 << 2) + 2] << 8 | this._buf[(i4 << 2) + 1] << 16 | this._buf[i4 << 2] << 24;
        }
        for(i4 = 0; i4 < 64; i4++){
            let tmp;
            if (i4 < 16) {
                tmp = w[i4];
            } else {
                let a = w[i4 + 1 & 15];
                let b = w[i4 + 14 & 15];
                tmp = w[i4 & 15] = (a >>> 7 ^ a >>> 18 ^ a >>> 3 ^ a << 25 ^ a << 14) + (b >>> 17 ^ b >>> 19 ^ b >>> 10 ^ b << 15 ^ b << 13) + w[i4 & 15] + w[i4 + 9 & 15] | 0;
            }
            tmp = tmp + h7 + (h4 >>> 6 ^ h4 >>> 11 ^ h4 >>> 25 ^ h4 << 26 ^ h4 << 21 ^ h4 << 7) + (h6 ^ h4 & (h5 ^ h6)) + this._K[i4] | 0;
            h7 = h6;
            h6 = h5;
            h5 = h4;
            h4 = h3 + tmp;
            h3 = h2;
            h2 = h1;
            h1 = h0;
            h0 = tmp + (h1 & h2 ^ h3 & (h1 ^ h2)) + (h1 >>> 2 ^ h1 >>> 13 ^ h1 >>> 22 ^ h1 << 30 ^ h1 << 19 ^ h1 << 10) | 0;
        }
        h[0] = h[0] + h0 | 0;
        h[1] = h[1] + h1 | 0;
        h[2] = h[2] + h2 | 0;
        h[3] = h[3] + h3 | 0;
        h[4] = h[4] + h4 | 0;
        h[5] = h[5] + h5 | 0;
        h[6] = h[6] + h6 | 0;
        h[7] = h[7] + h7 | 0;
    }
}
function sha256(msg, inputEncoding, outputEncoding) {
    return new SHA256().update(msg, inputEncoding).digest(outputEncoding);
}
function createHash(algorithm) {
    return new class {
        m = new Uint8Array();
        update(b) {
            this.m = b;
            return this;
        }
        digest() {
            if (algorithm === "sha1") {
                return sha1(this.m);
            } else if (algorithm === "sha256") {
                return sha256(this.m);
            }
            throw "Unsupport hash algorithm";
        }
    }();
}
function mgf1(seed, length, hash) {
    let counter = 0n;
    let output = [];
    while(output.length < length){
        let h;
        const c = i2osp1(counter, 4);
        if (typeof hash === "function") {
            h = hash(new Uint8Array([
                ...seed,
                ...c
            ]));
        } else {
            h = new Uint8Array(createHash(hash).update(new Uint8Array([
                ...seed,
                ...c
            ])).digest());
        }
        output = [
            ...output,
            ...h
        ];
        counter++;
    }
    return new Uint8Array(output.slice(0, length));
}
function eme_oaep_encode(label, m, k, algorithm) {
    const labelHash = new Uint8Array(createHash(algorithm).update(label).digest());
    const ps = new Uint8Array(k - labelHash.length * 2 - 2 - m.length);
    const db = concat1(labelHash, ps, [
        1
    ], m);
    const seed = random_bytes1(labelHash.length);
    const dbMask = mgf1(seed, k - labelHash.length - 1, algorithm);
    const maskedDb = xor1(db, dbMask);
    const seedMask = mgf1(maskedDb, labelHash.length, algorithm);
    const maskedSeed = xor1(seed, seedMask);
    return concat1([
        0
    ], maskedSeed, maskedDb);
}
function eme_oaep_decode(label, c, k, algorithm) {
    const labelHash = new Uint8Array(createHash(algorithm).update(label).digest());
    const maskedSeed = c.slice(1, 1 + labelHash.length);
    const maskedDb = c.slice(1 + labelHash.length);
    const seedMask = mgf1(maskedDb, labelHash.length, algorithm);
    const seed = xor1(maskedSeed, seedMask);
    const dbMask = mgf1(seed, k - labelHash.length - 1, algorithm);
    const db = xor1(maskedDb, dbMask);
    let ptr = labelHash.length;
    while(ptr < db.length && db[ptr] === 0)ptr++;
    return db.slice(ptr + 1);
}
function rsa_oaep_encrypt(bytes, n, e, m, algorithm) {
    const em = eme_oaep_encode(new Uint8Array(0), m, bytes, algorithm);
    const msg = os2ip1(em);
    const c = rsaep1(n, e, msg);
    return i2osp1(c, bytes);
}
function rsa_oaep_decrypt(key8, c, algorithm) {
    const em = rsadp1(key8, os2ip1(c));
    const m = eme_oaep_decode(new Uint8Array(0), i2osp1(em, key8.length), key8.length, algorithm);
    return m;
}
function digest(algorithm, m) {
    if (algorithm === "sha1") {
        return sha1(m);
    } else if (algorithm === "sha256") {
        return sha256(m);
    } else if (algorithm === "sha512") {
        return sha512(m);
    }
    throw "Unsupport hash algorithm";
}
function mgf11(seed, length, hash) {
    let counter = 0n;
    let output = [];
    while(output.length < length){
        const c = i2osp(counter, 4);
        const h = new Uint8Array(digest(hash, new Uint8Array([
            ...seed,
            ...c
        ])));
        output = [
            ...output,
            ...h
        ];
        counter++;
    }
    return new Uint8Array(output.slice(0, length));
}
function eme_oaep_encode1(label, m, k, algorithm) {
    const labelHash = new Uint8Array(digest(algorithm, label));
    const ps = new Uint8Array(k - labelHash.length * 2 - 2 - m.length);
    const db = concat(labelHash, ps, [
        1
    ], m);
    const seed = random_bytes(labelHash.length);
    const dbMask = mgf11(seed, k - labelHash.length - 1, algorithm);
    const maskedDb = xor(db, dbMask);
    const seedMask = mgf11(maskedDb, labelHash.length, algorithm);
    const maskedSeed = xor(seed, seedMask);
    return concat([
        0
    ], maskedSeed, maskedDb);
}
function eme_oaep_decode1(label, c, k, algorithm) {
    const labelHash = new Uint8Array(digest(algorithm, label));
    const maskedSeed = c.slice(1, 1 + labelHash.length);
    const maskedDb = c.slice(1 + labelHash.length);
    const seedMask = mgf11(maskedDb, labelHash.length, algorithm);
    const seed = xor(maskedSeed, seedMask);
    const dbMask = mgf11(seed, k - labelHash.length - 1, algorithm);
    const db = xor(maskedDb, dbMask);
    let ptr = labelHash.length;
    while(ptr < db.length && db[ptr] === 0)ptr++;
    return db.slice(ptr + 1);
}
function rsa_oaep_encrypt1(bytes, n, e, m, algorithm) {
    const em = eme_oaep_encode1(new Uint8Array(0), m, bytes, algorithm);
    const msg = os2ip(em);
    const c = rsaep(n, e, msg);
    return i2osp(c, bytes);
}
function rsa_oaep_decrypt1(key8, c, algorithm) {
    const em = rsadp(key8, os2ip(c));
    const m = eme_oaep_decode1(new Uint8Array(0), i2osp(em, key8.length), key8.length, algorithm);
    return m;
}
function emsa_pss_encode(m, emBits, sLen, algorithm) {
    const mHash = digest(algorithm, m);
    const hLen = mHash.length;
    const emLen = Math.ceil(emBits / 8);
    if (emLen < hLen + sLen + 2) throw "Encoding Error";
    const salt = new Uint8Array(sLen);
    crypto.getRandomValues(salt);
    const m1 = new Uint8Array([
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        ...mHash,
        ...salt
    ]);
    const h = digest(algorithm, m1);
    const ps = new Uint8Array(emLen - sLen - hLen - 2);
    const db = new Uint8Array([
        ...ps,
        1,
        ...salt
    ]);
    const dbMask = mgf11(h, emLen - hLen - 1, algorithm);
    const maskedDB = xor(db, dbMask);
    const leftMost = 8 * emLen - emBits;
    maskedDB[0] = maskedDB[0] & 255 >> leftMost;
    return new Uint8Array([
        ...maskedDB,
        ...h,
        188
    ]);
}
function emsa_pss_verify(m, em, emBits, sLen, algorithm) {
    const mHash = digest(algorithm, m);
    const hLen = mHash.length;
    const emLen = Math.ceil(emBits / 8);
    if (emLen < hLen + sLen + 2) return false;
    if (em[em.length - 1] !== 188) return false;
    const maskedDB = em.slice(0, emLen - hLen - 1);
    const h = em.slice(emLen - hLen - 1, emLen - 1);
    const leftMost = 8 * emLen - emBits;
    if (maskedDB[0] >> 8 - leftMost != 0) return false;
    const dbMask = mgf11(h, emLen - hLen - 1, algorithm);
    const db = xor(maskedDB, dbMask);
    db[0] = db[0] & 255 >> leftMost;
    for(let i4 = 1; i4 < emLen - hLen - sLen - 2; i4++){
        if (db[i4] !== 0) return false;
    }
    if (db[emLen - hLen - sLen - 2] !== 1) return false;
    const salt = db.slice(emLen - hLen - sLen - 1);
    const m1 = new Uint8Array([
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        ...mHash,
        ...salt
    ]);
    const h1 = digest(algorithm, m1);
    for(let i5 = 0; i5 < hLen; i5++){
        if (h1[i5] !== h[i5]) return false;
    }
    return true;
}
function rsassa_pss_sign(key8, m, algorithm) {
    if (!key8.d) throw "Invalid RSA Key";
    const hLen = digestLength(algorithm);
    let em = emsa_pss_encode(m, key8.length * 8 - 1, hLen, algorithm);
    return new RawBinary(i2osp(rsaep(key8.n, key8.d, os2ip(em)), key8.length));
}
function rsassa_pss_verify(key8, m, signature, algorithm) {
    if (!key8.e) throw "Invalid RSA Key";
    const hLen = digestLength(algorithm);
    const em = i2osp(rsaep(key8.n, key8.e, os2ip(signature)), key8.length);
    return emsa_pss_verify(m, em, key8.length * 8 - 1, hLen, algorithm);
}
function hmac(algorithm, key8, data) {
    const blockSize = 64;
    const computedData = typeof data === "string" ? new TextEncoder().encode(data) : data;
    let computedKey = typeof key8 === "string" ? new TextEncoder().encode(key8) : key8;
    if (computedKey.length > 64) {
        computedKey = digest(algorithm, computedKey);
    }
    if (computedKey.length < 64) {
        const tmp = new Uint8Array(64);
        tmp.set(computedKey, 0);
        computedKey = tmp;
    }
    const opad = new Uint8Array(computedKey);
    const ipad = new Uint8Array(computedKey);
    for(let i4 = 0; i4 < 64; i4++){
        opad[i4] = computedKey[i4] ^ 92;
        ipad[i4] = computedKey[i4] ^ 54;
    }
    const output = digest(algorithm, concat(opad, digest(algorithm, concat(ipad, computedData))));
    return new RawBinary(output);
}
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
function rsa_pkcs1_verify(key8, s, m) {
    if (!key8.e) throw "Invalid RSA key";
    let em = i2osp(rsaep(key8.n, key8.e, os2ip(s)), key8.length);
    if (em[0] !== 0) throw "Decryption error";
    if (em[1] !== 1) throw "Decryption error";
    let psCursor = 2;
    for(; psCursor < em.length; psCursor++){
        if (em[psCursor] === 0) break;
    }
    if (psCursor < 10) throw "Decryption error";
    em = em.slice(psCursor + 1);
    const ber = ber_simple(ber_decode2(em));
    const decryptedMessage = ber[1];
    if (decryptedMessage.length !== m.length) return false;
    for(let i4 = 0; i4 < decryptedMessage.length; i4++){
        if (decryptedMessage[i4] !== m[i4]) return false;
    }
    return true;
}
class PureRSA {
    static async encrypt(key, message, options) {
        if (!key.e) throw "Invalid RSA key";
        if (options.padding === "oaep") {
            return new RawBinary(rsa_oaep_encrypt1(key.length, key.n, key.e, message, options.hash));
        } else if (options.padding === "pkcs1") {
            return new RawBinary(rsa_pkcs1_encrypt(key.length, key.n, key.e, message));
        }
        throw "Invalid parameters";
    }
    static async decrypt(key, ciper, options) {
        if (!key.d) throw "Invalid RSA key";
        if (options.padding === "oaep") {
            return new RawBinary(rsa_oaep_decrypt1(key, ciper, options.hash));
        } else if (options.padding === "pkcs1") {
            return new RawBinary(rsa_pkcs1_decrypt(key, ciper));
        }
        throw "Invalid parameters";
    }
    static async verify(key, signature, message, options) {
        if (!key.e) throw "Invalid RSA key";
        if (options.algorithm === "rsassa-pkcs1-v1_5") {
            return rsa_pkcs1_verify(key, signature, digest(options.hash, message));
        } else {
            return rsassa_pss_verify(key, message, signature, options.hash);
        }
    }
    static async sign(key, message, options) {
        if (!key.d) throw "You need private key to sign the message";
        if (options.algorithm === "rsassa-pkcs1-v1_5") {
            return rsa_pkcs1_sign(key.length, key.n, key.d, digest(options.hash, message), options.hash);
        } else {
            return rsassa_pss_sign(key, message, options.hash);
        }
    }
}
function rsa_import_pem_cert(key8) {
    const trimmedKey = key8.substr(27, key8.length - 53);
    const parseKey = ber_simple(ber_decode3(base64_to_binary(trimmedKey)));
    return {
        length: get_key_size(parseKey[0][5][1][0][0]),
        n: parseKey[0][5][1][0][0],
        e: parseKey[0][5][1][0][1]
    };
}
function rsa_import_pem_private(key8) {
    const trimmedKey = key8.substr(31, key8.length - 61);
    const parseKey = ber_simple(ber_decode3(base64_to_binary(trimmedKey)));
    return {
        n: parseKey[1],
        d: parseKey[3],
        e: parseKey[2],
        p: parseKey[4],
        q: parseKey[5],
        dp: parseKey[6],
        dq: parseKey[7],
        qi: parseKey[8],
        length: get_key_size(parseKey[1])
    };
}
function rsa_import_pem_private_pkcs8(key8) {
    const trimmedKey = key8.substr(27, key8.length - 57);
    const parseWrappedKey = ber_simple(ber_decode3(base64_to_binary(trimmedKey)));
    const parseKey = ber_simple(ber_decode3(parseWrappedKey[2]));
    return {
        n: parseKey[1],
        d: parseKey[3],
        e: parseKey[2],
        p: parseKey[4],
        q: parseKey[5],
        dp: parseKey[6],
        dq: parseKey[7],
        qi: parseKey[8],
        length: get_key_size(parseKey[1])
    };
}
function rsa_import_pem_public(key8) {
    const trimmedKey = key8.substr(26, key8.length - 51);
    const parseKey = ber_simple(ber_decode3(base64_to_binary(trimmedKey)));
    return {
        length: get_key_size(parseKey[1][0][0]),
        n: parseKey[1][0][0],
        e: parseKey[1][0][1]
    };
}
function rsa_import_pem(key8) {
    if (typeof key8 !== "string") throw new TypeError("PEM key must be string");
    const trimmedKey = key8.trim();
    const maps = [
        [
            "-----BEGIN RSA PRIVATE KEY-----",
            rsa_import_pem_private
        ],
        [
            "-----BEGIN PRIVATE KEY-----",
            rsa_import_pem_private_pkcs8
        ],
        [
            "-----BEGIN PUBLIC KEY-----",
            rsa_import_pem_public
        ],
        [
            "-----BEGIN CERTIFICATE-----",
            rsa_import_pem_cert
        ], 
    ];
    for (const [prefix, func] of maps){
        if (trimmedKey.indexOf(prefix) === 0) return func(trimmedKey);
    }
    throw new TypeError("Unsupported key format");
}
function rsa_import_key(key8, format1) {
    const finalFormat = format1 === "auto" ? detect_format(key8) : format1;
    if (finalFormat === "jwk") return rsa_import_jwk1(key8);
    if (finalFormat === "pem") return rsa_import_pem(key8);
    throw new TypeError("Unsupported key format");
}
class RSA {
    constructor(key8){
        this.key = key8;
    }
    async encrypt(m, options) {
        const computedOption = computeOption(options);
        const func = WebCryptoRSA.isSupported(computedOption) ? WebCryptoRSA.encrypt : PureRSA.encrypt;
        return new RawBinary(await func(this.key, computeMessage(m), computedOption));
    }
    async decrypt(m, options) {
        const computedOption = computeOption(options);
        const func = WebCryptoRSA.isSupported(computedOption) ? WebCryptoRSA.decrypt : PureRSA.decrypt;
        return new RawBinary(await func(this.key, m, computedOption));
    }
    async verify(signature, message, options) {
        const computedOption = {
            algorithm: "rsassa-pkcs1-v1_5",
            hash: "sha256",
            ...options
        };
        return await PureRSA.verify(this.key, signature, computeMessage(message), computedOption);
    }
    async sign(message, options) {
        const computedOption = {
            algorithm: "rsassa-pkcs1-v1_5",
            hash: "sha256",
            ...options
        };
        return await PureRSA.sign(this.key, computeMessage(message), computedOption);
    }
    static parseKey(key, format = "auto") {
        return this.importKey(key, format);
    }
    static importKey(key, format = "auto") {
        return new RSAKey1(rsa_import_key(key, format));
    }
}
function rsa_pkcs1_verify1(key9, s, m) {
    if (!key9.e) throw "Invalid RSA key";
    let em = i2osp1(rsaep1(key9.n, key9.e, os2ip1(s)), key9.length);
    if (em[0] !== 0) throw "Decryption error";
    if (em[1] !== 1) throw "Decryption error";
    let psCursor = 2;
    for(; psCursor < em.length; psCursor++){
        if (em[psCursor] === 0) break;
    }
    if (psCursor < 10) throw "Decryption error";
    em = em.slice(psCursor + 1);
    const ber = ber_simple1(ber_decode4(em));
    const decryptedMessage = ber[1];
    if (decryptedMessage.length !== m.length) return false;
    for(let i4 = 0; i4 < decryptedMessage.length; i4++){
        if (decryptedMessage[i4] !== m[i4]) return false;
    }
    return true;
}
class PureRSA1 {
    static async encrypt(key, message, options) {
        if (!key.e) throw "Invalid RSA key";
        if (options.padding === "oaep") {
            return new RawBinary1(rsa_oaep_encrypt(key.length, key.n, key.e, message, options.hash));
        } else if (options.padding === "pkcs1") {
            return new RawBinary1(rsa_pkcs1_encrypt1(key.length, key.n, key.e, message));
        }
        throw "Invalid parameters";
    }
    static async decrypt(key, ciper, options) {
        if (!key.d) throw "Invalid RSA key";
        if (options.padding === "oaep") {
            return new RawBinary1(rsa_oaep_decrypt(key, ciper, options.hash));
        } else if (options.padding === "pkcs1") {
            return new RawBinary1(rsa_pkcs1_decrypt1(key, ciper));
        }
        throw "Invalid parameters";
    }
    static async verify(key, signature, message, options) {
        if (!key.e) throw "Invalid RSA key";
        return rsa_pkcs1_verify1(key, signature, createHash(options.hash).update(message).digest());
    }
    static async sign(key, message, options) {
        if (!key.d) throw "You need private key to sign the message";
        return rsa_pkcs1_sign1(key.length, key.n, key.d, createHash(options.hash).update(message).digest());
    }
}
function rsa_import_pem_cert1(key9) {
    const trimmedKey = key9.substr(27, key9.length - 53);
    const parseKey = ber_simple1(ber_decode5(base64_to_binary1(trimmedKey)));
    return {
        length: get_key_size1(parseKey[0][5][1][0][0]),
        n: parseKey[0][5][1][0][0],
        e: parseKey[0][5][1][0][1]
    };
}
function rsa_import_pem_private1(key9) {
    const trimmedKey = key9.substr(31, key9.length - 61);
    const parseKey = ber_simple1(ber_decode5(base64_to_binary1(trimmedKey)));
    return {
        n: parseKey[1],
        d: parseKey[3],
        e: parseKey[2],
        p: parseKey[4],
        q: parseKey[5],
        dp: parseKey[6],
        dq: parseKey[7],
        qi: parseKey[8],
        length: get_key_size1(parseKey[1])
    };
}
function rsa_import_pem_private_pkcs81(key9) {
    const trimmedKey = key9.substr(27, key9.length - 57);
    const parseWrappedKey = ber_simple1(ber_decode5(base64_to_binary1(trimmedKey)));
    const parseKey = ber_simple1(ber_decode5(parseWrappedKey[2]));
    return {
        n: parseKey[1],
        d: parseKey[3],
        e: parseKey[2],
        p: parseKey[4],
        q: parseKey[5],
        dp: parseKey[6],
        dq: parseKey[7],
        qi: parseKey[8],
        length: get_key_size1(parseKey[1])
    };
}
function rsa_import_pem_public1(key9) {
    const trimmedKey = key9.substr(26, key9.length - 51);
    const parseKey = ber_simple1(ber_decode5(base64_to_binary1(trimmedKey)));
    return {
        length: get_key_size1(parseKey[1][0][0]),
        n: parseKey[1][0][0],
        e: parseKey[1][0][1]
    };
}
function rsa_import_pem1(key9) {
    if (typeof key9 !== "string") throw new TypeError("PEM key must be string");
    const trimmedKey = key9.trim();
    const maps = [
        [
            "-----BEGIN RSA PRIVATE KEY-----",
            rsa_import_pem_private1
        ],
        [
            "-----BEGIN PRIVATE KEY-----",
            rsa_import_pem_private_pkcs81
        ],
        [
            "-----BEGIN PUBLIC KEY-----",
            rsa_import_pem_public1
        ],
        [
            "-----BEGIN CERTIFICATE-----",
            rsa_import_pem_cert1
        ], 
    ];
    for (const [prefix, func] of maps){
        if (trimmedKey.indexOf(prefix) === 0) return func(trimmedKey);
    }
    throw new TypeError("Unsupported key format");
}
function rsa_import_key1(key9, format2) {
    const finalFormat = format2 === "auto" ? detect_format1(key9) : format2;
    if (finalFormat === "jwk") return rsa_import_jwk(key9);
    if (finalFormat === "pem") return rsa_import_pem1(key9);
    throw new TypeError("Unsupported key format");
}
class RSA1 {
    constructor(key9){
        this.key = key9;
    }
    async encrypt(m, options) {
        const computedOption = computeOption1(options);
        const func = WebCryptoRSA1.isSupported(computedOption) ? WebCryptoRSA1.encrypt : PureRSA1.encrypt;
        return new RawBinary1(await func(this.key, computeMessage2(m), computedOption));
    }
    async decrypt(m, options) {
        const computedOption = computeOption1(options);
        const func = WebCryptoRSA1.isSupported(computedOption) ? WebCryptoRSA1.decrypt : PureRSA1.decrypt;
        return new RawBinary1(await func(this.key, m, computedOption));
    }
    async verify(signature, message, options) {
        const computedOption = {
            ...options,
            algorithm: "rsassa-pkcs1-v1_5",
            hash: "sha256"
        };
        return await PureRSA1.verify(this.key, signature, computeMessage2(message), computedOption);
    }
    async sign(message, options) {
        const computedOption = {
            ...options,
            algorithm: "rsassa-pkcs1-v1_5",
            hash: "sha256"
        };
        return await PureRSA1.sign(this.key, computeMessage2(message), computedOption);
    }
    static parseKey(key, format = "auto") {
        return this.importKey(key, format);
    }
    static importKey(key, format = "auto") {
        return new RSAKey(rsa_import_key1(key, format));
    }
}
async function encrypt(algorithm, key10, message) {
    switch(algorithm){
        case "none":
            return "";
        case "HS256":
            return new HmacSha256(key10).update(message).toString();
        case "HS512":
            return new HmacSha512(key10).update(message).toString();
        case "RS256":
            return (await new RSA1(RSA1.parseKey(key10)).sign(message, {
                hash: "sha256"
            })).hex();
        default:
            assertNever(algorithm, "no matching crypto algorithm in the header: " + algorithm);
    }
}
async function create(algorithm, key10, input) {
    return convertHexToBase64url(await encrypt(algorithm, key10, input));
}
async function verify1({ signature , key: key10 , algorithm , signingInput  }) {
    switch(algorithm){
        case "none":
        case "HS256":
        case "HS512":
            {
                return safeCompare(signature, await encrypt(algorithm, key10, signingInput));
            }
        case "RS256":
            {
                return await new RSA1(RSA1.parseKey(key10)).verify(decodeString(signature), signingInput, {
                    hash: "sha256"
                });
            }
        default:
            assertNever(algorithm, "no matching crypto algorithm in the header: " + algorithm);
    }
}
const verifySignatureAndDecode = (jwks1)=>async (jwtToken)=>{
        const { header , payload  } = decode(jwtToken);
        const key10 = jwks1.find((jwk)=>jwk.kid === header.kid
        );
        if (!key10) throw new Error(`JWK with id ${header.kid} not found`);
        const publicKey = RSA.parseKey(key10);
        const rsa = new RSA(publicKey);
        const [headerb64, payloadb64, signatureb64] = jwtToken.split(".");
        const verified = await rsa.verify(encode2.base64url(signatureb64), headerb64 + "." + payloadb64, {
            algorithm: "rsassa-pkcs1-v1_5",
            hash: "sha256"
        });
        if (verified) return payload;
        throw new Error("Token signature invalid");
    }
;
const getUserIdGetter = (jwks1, clientId1)=>async (request)=>{
        const token = getToken(request);
        if (!token) return undefined;
        return Promise.resolve(token).then(verifySignatureAndDecode(jwks1)).then(verifyIssuer).then(verifyAudience(clientId1)).then(verifyExpiry).then(getUserIdFromPayload);
    }
;
const userIdGetter = getUserIdGetter(jwks, clientId);
const listActions = getServerActionLister(userIdGetter, userActionsGetter);
const saveActions = getServerActionSaver(userIdGetter, userActionsSaver);
const handleRequest = getMainHandler({
    handlePage: getPageHandler(listActions),
    handleSave: getSaveHandler(getActionSaver(listActions, saveActions)),
    handleAsset: getAssetFromKV,
    handleRoutes: {
        "/actions.json": async (request)=>{
            const actions = await listActions(request);
            return new Response(JSON.stringify(actions));
        }
    }
});
self.addEventListener("fetch", (event)=>{
    event.respondWith(handleRequest(event));
});
function ber_decode(bytes, from, to) {
    return ber_next1(bytes);
}
function ber_sequence(bytes, from, length) {
    const end = from + length;
    let res = [];
    let ptr = from;
    while(ptr < end){
        const next = ber_next1(bytes, ptr);
        res.push(next);
        ptr += next.totalLength;
    }
    return res;
}
function ber_next1(bytes, from, to) {
    if (!from) from = 0;
    if (!to) to = bytes.length;
    let ptr = from;
    const type = bytes[ptr++];
    let size = bytes[ptr++];
    if ((size & 128) > 0) {
        let ext = size - 128;
        size = 0;
        while((--ext) >= 0){
            size = (size << 8) + bytes[ptr++];
        }
    }
    let value = null;
    if (type === 48) {
        value = ber_sequence(bytes, ptr, size);
    } else if (type === 2) {
        value = ber_integer(bytes, ptr, size);
    } else if (type === 3) {
        value = ber_sequence(bytes, ptr + 1, size - 1);
    } else if (type === 5) {
        value = null;
    } else if (type === 6) {
        value = ber_oid(bytes, ptr, size);
    } else {
        value = ber_unknown(bytes, ptr, size);
    }
    return {
        totalLength: ptr - from + size,
        type,
        length: size,
        value
    };
}
function ber_decode1(bytes, from, to) {
    return ber_next2(bytes);
}
function ber_sequence1(bytes, from, length) {
    const end = from + length;
    let res = [];
    let ptr = from;
    while(ptr < end){
        const next = ber_next2(bytes, ptr);
        res.push(next);
        ptr += next.totalLength;
    }
    return res;
}
function ber_next2(bytes, from, to) {
    if (!from) from = 0;
    if (!to) to = bytes.length;
    let ptr = from;
    const type = bytes[ptr++];
    let size = bytes[ptr++];
    if ((size & 128) > 0) {
        let ext = size - 128;
        size = 0;
        while((--ext) >= 0){
            size = (size << 8) + bytes[ptr++];
        }
    }
    let value = null;
    if (type === 48) {
        value = ber_sequence1(bytes, ptr, size);
    } else if (type === 2) {
        value = ber_integer1(bytes, ptr, size);
    } else if (type === 3) {
        value = ber_sequence1(bytes, ptr + 1, size - 1);
    } else if (type === 5) {
        value = null;
    } else if (type === 6) {
        value = ber_oid1(bytes, ptr, size);
    } else {
        value = ber_unknown1(bytes, ptr, size);
    }
    return {
        totalLength: ptr - from + size,
        type,
        length: size,
        value
    };
}
const ber_decode2 = ber_decode;
const ber_decode3 = ber_decode;
const ber_decode4 = ber_decode1;
const ber_decode5 = ber_decode1;
