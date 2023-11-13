"use strict";
var createCanvas = function (width, height) {
    var canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    var context = canvas.getContext('2d');
    return [canvas, context];
};
var createGame = function () {
    var background = createGameBackground();
    var createLevel = function (levelData, resources, onLevelFinish) {
        var _a = createCanvas(1280, 720), canvas = _a[0], context = _a[1];
        var space = createSpace();
        var cancelFrameLoop;
        var inputControl = createInputControl(canvas);
        var spoolRenderSystem = createSpoolRenderSystem(resources);
        var cableRenderSystem = createCableRenderSystem();
        var shutdown = function () {
            cancelFrameLoop();
            inputControl.shutdown();
            space.shutdown();
            document.body.style.cursor = 'default';
        };
        var spoolSystem = createSpoolSystem(function () {
            shutdown();
            onLevelFinish();
        });
        var mouseDragSystem = createMouseDragSystem(inputControl);
        // uncomment this lines and the line at the bottom to enable editor mode
        // const levelEditorSystem = createLevelEditorSystem(space, inputControl);
        // space.registerSystem(levelEditorSystem);
        space.registerSystem(spoolRenderSystem);
        space.registerSystem(spoolSystem);
        space.registerSystem(cableRenderSystem);
        space.registerSystem(mouseDragSystem);
        levelData.spools.forEach(function (spoolData) {
            var spoolEntity = {
                pos: { x: spoolData[0], y: spoolData[1] },
                spool: { size: spoolData[2], type: NodeType.spool },
                render: { type: NodeType.spool },
            };
            space.addEntity(spoolEntity);
        });
        levelData.blocks.forEach(function (block) {
            var blockEntity = {
                pos: { x: block[0], y: block[1] },
                block: { size: block[2] },
                render: { type: NodeType.block }
            };
            space.addEntity(blockEntity);
        });
        levelData.isolators.forEach(function (isolator) {
            var blockEntity = {
                pos: { x: isolator[0], y: isolator[1] },
                spool: { size: isolator[2], type: NodeType.isolator },
                render: { type: NodeType.isolator }
            };
            space.addEntity(blockEntity);
        });
        var start = {
            pos: { x: levelData.start[0], y: levelData.start[1] },
            spool: { size: 0, type: NodeType.start },
            render: { type: NodeType.start }
        };
        var end = {
            pos: { x: levelData.end[0], y: levelData.end[1] },
            spool: { size: 0, type: NodeType.end },
            render: { type: NodeType.end },
            mouseDrag: { size: 30 }
        };
        var cable = {
            cable: { attachments: [{ entity: start, side: Side.left }, { entity: end, side: Side.left }] }
        };
        var finish = {
            finish: {},
            render: { type: NodeType.finish },
            pos: { x: levelData.finish[0], y: levelData.finish[1] }
        };
        //TODO: render layers
        space.addEntity(start);
        space.addEntity(finish);
        space.addEntity(end);
        space.addEntity(cable);
        var update = function (time) {
            mouseDragSystem.update(time);
            spoolSystem.update(time);
            // levelEditorSystem.update(time);
        };
        var render = function (time) {
            context.drawImage(background, 0, 0);
            cableRenderSystem.render(context, time);
            spoolRenderSystem.render(context, time);
        };
        cancelFrameLoop = startFrameLoop(function (time) {
            update(time);
            render(time);
        });
        return {
            canvas: canvas,
            shutdown: shutdown
        };
    };
    return {
        createLevel: createLevel
    };
};
// https://gist.github.com/blixt/f17b47c62508be59987b
var clamp = function (num, min, max) { return num < min ? min : num > max ? max : num; };
// https://gist.github.com/Joncom/e8e8d18ebe7fe55c3894
var lineLineIntersect = function (line1a, line1b, line2a, line2b) {
    // var s1_x, s1_y, s2_x, s2_y;
    var s1_x = line1b.x - line1a.x;
    var s1_y = line1b.y - line1a.y;
    var s2_x = line2b.x - line2a.x;
    var s2_y = line2b.y - line2a.y;
    // var s, t;
    var s = (-s1_y * (line1a.x - line2a.x) + s1_x * (line1a.y - line2a.y)) / (-s2_x * s1_y + s1_x * s2_y);
    var t = (s2_x * (line1a.y - line2a.y) - s2_y * (line1a.x - line2a.x)) / (-s2_x * s1_y + s1_x * s2_y);
    return s >= 0 && s <= 1 && t >= 0 && t <= 1;
};
// borrowed from https://codereview.stackexchange.com/questions/192477/circle-line-segment-collision
var lineCircleIntersect = function (lineA, lineB, circle, radius) {
    var dist;
    var v1x = lineB.x - lineA.x;
    var v1y = lineB.y - lineA.y;
    var v2x = circle.x - lineA.x;
    var v2y = circle.y - lineA.y;
    // get the unit distance along the line of the closest point to
    // circle center
    var u = (v2x * v1x + v2y * v1y) / (v1y * v1y + v1x * v1x);
    // if the point is on the line segment get the distance squared
    // from that point to the circle center
    if (u >= 0 && u <= 1) {
        dist = Math.pow((lineA.x + v1x * u - circle.x), 2) + Math.pow((lineA.y + v1y * u - circle.y), 2);
    }
    else {
        // if closest point not on the line segment
        // use the unit distance to determine which end is closest
        // and get dist square to circle
        dist = u < 0 ?
            Math.pow((lineA.x - circle.x), 2) + Math.pow((lineA.y - circle.y), 2) :
            Math.pow((lineB.x - circle.x), 2) + Math.pow((lineB.y - circle.y), 2);
    }
    return dist < radius * radius;
};
// https://jsfiddle.net/MadLittleMods/0eh0zeyu/
var dist2 = function (pt1, pt2) { return Math.pow(pt1.x - pt2.x, 2) + Math.pow(pt1.y - pt2.y, 2); };
// https://en.wikibooks.org/wiki/Algorithm_Implementation/Geometry/Tangents_between_two_circles
var getTangents = function (p1, r1, p2, r2) {
    var d_sq = (p1.x - p2.x) * (p1.x - p2.x) + (p1.y - p2.y) * (p1.y - p2.y);
    if (d_sq <= (r1 - r2) * (r1 - r2))
        return [];
    var d = Math.sqrt(d_sq);
    var vx = (p2.x - p1.x) / d;
    var vy = (p2.y - p1.y) / d;
    // double[][] res = new double[4][4];
    var result = [];
    var i = 0;
    // Let A, B be the centers, and C, D be points at which the tangent
    // touches first and second circle, and n be the normal vector to it.
    //
    // We have the system:
    //   n * n = 1          (n is a unit vector)
    //   C = A + r1 * n
    //   D = B +/- r2 * n
    //   n * CD = 0         (common orthogonality)
    //
    // n * CD = n * (AB +/- r2*n - r1*n) = AB*n - (r1 -/+ r2) = 0,  <=>
    // AB * n = (r1 -/+ r2), <=>
    // v * n = (r1 -/+ r2) / d,  where v = AB/|AB| = AB/d
    // This is a linear equation in unknown vector n.
    for (var sign1 = +1; sign1 >= -1; sign1 -= 2) {
        var c = (r1 - sign1 * r2) / d;
        // Now we're just intersecting a line with a circle: v*n=c, n*n=1
        if (c * c > 1.0)
            continue;
        var h = Math.sqrt(Math.max(0.0, 1.0 - c * c));
        for (var sign2 = +1; sign2 >= -1; sign2 -= 2) {
            var nx = vx * c - sign2 * h * vy;
            var ny = vy * c + sign2 * h * vx;
            result[i] = [];
            var a = result[i] = new Array(2);
            a[0] = { x: p1.x + r1 * nx, y: p1.y + r1 * ny };
            a[1] = { x: p2.x + sign1 * r2 * nx, y: p2.y + sign1 * r2 * ny };
            i++;
        }
    }
    return result;
};
var sideOfLine = function (p1, p2, p) { return ((p2.x - p1.x) * (p.y - p1.y) - (p2.y - p1.y) * (p.x - p1.x)) > 0 ? Side.left : Side.right; };
/// <reference path="math-util.ts" />
var fract = function (n) { return ((n % 1) + 1) % 1; };
var subV = function (v1, v2) { return ({ x: v1.x - v2.x, y: v1.y - v2.y }); };
var addV = function (v1, v2) { return ({ x: v1.x + v2.x, y: v1.y + v2.y }); };
var mulVS = function (v, s) { return ({ x: v.x * s, y: v.y * s }); };
var divVS = function (v, s) { return mulVS(v, 1 / s); };
var lenV = function (v) { return Math.sqrt(v.x * v.x + v.y * v.y); };
var distV = function (v1, v2) { return lenV(subV(v1, v2)); };
var normalizeV = function (v) { return divVS(v, lenV(v) || 1); };
var perpLeftV = function (v) { return ({ x: -v.y, y: v.x }); };
var perpRightV = function (v) { return ({ x: v.y, y: -v.x }); };
var angleV = function (v) {
    var angle = Math.atan2(v.y, v.x);
    if (angle < 0)
        angle += 2 * Math.PI;
    return angle;
};
var copyIntoV = function (target, source) {
    target.x = source.x;
    target.y = source.y;
};
var copyV = function (source) { return ({ x: source.x, y: source.y }); };
var fractV = function (v) { return ({ x: fract(v.x), y: fract(v.y) }); };
var floorV = function (v) { return ({ x: ~~v.x, y: ~~v.y }); };
/// <reference path="canvas.ts" />
/// <reference path="vector.ts" />
var mix = function (a, b, m) { return (1 - m) * a + m * b; };
var mixCol = function (a, b, m) { return ({
    r: mix(a.r, b.r, m),
    g: mix(a.g, b.g, m),
    b: mix(a.b, b.b, m),
    a: mix(a.a, b.a, m),
}); };
var halfV = { x: 0.5, y: 0.5 };
var v10 = { x: 1, y: 0 };
var v01 = { x: 0, y: 1 };
var v11 = { x: 1, y: 1 };
var n21 = function (v) { return ((Math.sin(v.x * 100 + v.y * 6574) + 1) * 564) % 1; };
var noise = function (v) {
    var lv = fractV(v);
    var id = floorV(v);
    var bl = n21(id);
    var br = n21(addV(id, v10));
    var b = mix(bl, br, lv.x);
    var tl = n21(addV(id, v01));
    var tr = n21(addV(id, v11));
    var t = mix(tl, tr, lv.x);
    return mix(b, t, lv.y);
};
var smoothstep = function (min, max, value) {
    var x = clamp((value - min) / (max - min), 0, 1);
    return x * x * (3 - 2 * x);
};
var newCol = function (r, g, b, a) {
    if (r === void 0) { r = 1; }
    if (g === void 0) { g = 1; }
    if (b === void 0) { b = 1; }
    if (a === void 0) { a = 1; }
    return ({ r: r, g: g, b: b, a: a });
};
var mulCol = function (color, v) { return ({
    r: color.r * v,
    g: color.g * v,
    b: color.b * v,
    a: color.a
}); };
var addCol = function (a, b) {
    return {
        r: a.r + b.r * b.a,
        g: a.g + b.g * b.a,
        b: a.b + b.b * b.a,
        a: a.a + b.a
    };
};
var generateImage = function (width, height, cb) {
    var _a = createCanvas(width, height), canvas = _a[0], context = _a[1];
    var imageData = context.getImageData(0, 0, width, height);
    var buf = new ArrayBuffer(imageData.data.length);
    var buf8 = new Uint8ClampedArray(buf);
    var data32 = new Uint32Array(buf);
    var v = {};
    for (var y = 0; y < height; y++) {
        for (var x = 0; x < width; x++) {
            v.x = x / (width - 1);
            v.y = y / (height - 1);
            var c = cb(v);
            data32[y * width + x] =
                (clamp(c.a * 255, 0, 255) << 24) | // alpha
                    (clamp(c.b * 255, 0, 255) << 16) | // blue
                    (clamp(c.g * 255, 0, 255) << 8) | // green
                    clamp(c.r * 255, 0, 255);
        }
    }
    imageData.data.set(buf8);
    context.putImageData(imageData, 0, 0);
    return canvas;
};
// https://gist.github.com/sakrist/8706749
var createHexField = function (v, scale) {
    var _a = mulVS(v, scale), x = _a.x, y = _a.y;
    x *= 0.57735 * 2.0;
    y += (Math.floor(x) % 2) * 0.5;
    x = Math.abs(x % 1 - 0.5);
    y = Math.abs(y % 1 - 0.5);
    return Math.abs(Math.max(x * 1.5 + y, y * 2.0) - 1.0);
};
var createMetalPlate = function (a, d) {
    var shading = smoothstep(0.91, 0.94, d) - smoothstep(0.41, 0.42, d);
    a += shading;
    return 0.9 + 0.1 * Math.sin(a * 6) * 0.9 + 0.1 * Math.sin(a * 4)
        - (noise({ x: (a + 4 + d * 5) * 2, y: d * 80 }) * 0.1) + shading * 0.2;
};
var createCoilSprite = function (size) {
    var sw = 4 / size;
    var hexFieldScale = size / 4;
    var hexFieldBrightness = 0.7;
    var ringBrightness = 0.4;
    var gridShadowBlur = 0.1;
    var gridShadowStrength = 1;
    var ringWidth = 0.2;
    var buttonSize = 0.5;
    var gridColor = newCol(0.615, 0.705, 1, 1);
    var metalColor = newCol(1, 1, 1, 1);
    var shadowBlur = 0.2;
    var shadowDistance = 0.04;
    var shadowScale = 1.1;
    var shadowStrength = 0.5;
    var image = generateImage(Math.round(size * 1.1), Math.round(size * 1.1), function (v) {
        v = mulVS(v, 1.1); // scale to make room for shadow
        var centerV = subV(v, halfV);
        var a = Math.atan2(centerV.y, centerV.x);
        var d = lenV(centerV) * 2;
        var grid = hexFieldBrightness * smoothstep(0.3, 1, 1 - createHexField(v, hexFieldScale)); // TODO: FOR SPOOL
        var gridShadow = 1 - (smoothstep(1 - ringWidth * 0.65, 1 - ringWidth - gridShadowBlur, d) -
            smoothstep(buttonSize + gridShadowBlur, buttonSize * 0.85, d));
        grid -= (gridShadow * gridShadowStrength);
        var metalPlate = createMetalPlate(a, d) * ringBrightness;
        var ringMask = smoothstep(1 - ringWidth, 1 - ringWidth + sw, d) + smoothstep(buttonSize, buttonSize - sw, d);
        var spriteCol = mixCol(mulCol(gridColor, grid), mulCol(metalColor, metalPlate), ringMask);
        var shadow = smoothstep(1, 1 - shadowBlur, lenV(subV(centerV, {
            x: shadowDistance,
            y: shadowDistance
        })) * 2 / shadowScale) * shadowStrength;
        var shadowCol = newCol(0, 0, 0, shadow);
        return mixCol(spriteCol, shadowCol, smoothstep(1 - sw, 1, d));
    });
    return image;
};
var createIsolatorSprite = function (size) {
    var sw = 4 / size;
    var hexFieldScale = size / 8;
    var hexFieldBrightness = 0.7;
    var ringBrightness = 0.4;
    var gridShadowBlur = 0.2;
    var gridShadowStrength = 0.6;
    var ringWidth = 0.15;
    var buttonSize = 0.3;
    var gridColor = newCol(0.815, 0.2705, .2, 1); // isolate red
    var metalColor = newCol(1, 1, 1, 1);
    var shadowBlur = 0.2;
    var shadowDistance = 0.04;
    var shadowScale = 1.1;
    var shadowStrength = 0.5;
    var image = generateImage(Math.round(size * 1.1), Math.round(size * 1.1), function (v) {
        v = mulVS(v, 1.1); // scale to make room for shadow
        var centerV = subV(v, halfV);
        var a = Math.atan2(centerV.y, centerV.x); // polar x
        var d = lenV(centerV) * 2; // polar y
        var grid = hexFieldBrightness * smoothstep(0.02, 0.41, 1 - createHexField(v, hexFieldScale)); // TODO FOR ISOLATOR
        var gridShadow = 1 - (smoothstep(1 - ringWidth * 0.65, 1 - ringWidth - gridShadowBlur, d) -
            smoothstep(buttonSize + gridShadowBlur, buttonSize * 0.85, d));
        grid -= (gridShadow * gridShadowStrength);
        var metalPlate = createMetalPlate(a, d) * ringBrightness;
        var ringMask = smoothstep(1 - ringWidth, 1 - ringWidth + sw, d) + smoothstep(buttonSize, buttonSize - sw, d);
        var spriteCol = mixCol(mulCol(gridColor, grid), mulCol(metalColor, metalPlate), ringMask);
        var shadow = smoothstep(1, 1 - shadowBlur, lenV(subV(centerV, {
            x: shadowDistance,
            y: shadowDistance
        })) * 2 / shadowScale) * shadowStrength;
        var shadowCol = newCol(0, 0, 0, shadow);
        return mixCol(spriteCol, shadowCol, smoothstep(1 - sw, 1, d));
    });
    return image;
};
var createGear = function (px, py, outerSize, innerSize, step) {
    var s = Math.min(fract(px), fract(1 - px)) * 2;
    var spikes = smoothstep(0, step * 8, s - py);
    var center = smoothstep(innerSize, innerSize + step, 1 - py);
    var cut = smoothstep(outerSize + step, outerSize, 1 - py);
    return clamp(spikes + center - cut, 0, 1);
};
var createBlockSprite = function (size) {
    var image = generateImage(size, size, function (v) {
        var cv = subV(v, halfV);
        var d = lenV(cv) * 2;
        var atan = Math.atan2(cv.y, cv.x);
        var px = atan / (Math.PI * 2) + 0.5; // polar twistedMx
        var twistedPx = atan / (Math.PI * 2) + 0.5 + d * 0.3; // polar twistedMx
        var twistedMx = twistedPx * Math.round(8 + size / 50);
        var mx = px * Math.round(5 + size / 200);
        var m = Math.min(fract(twistedMx), fract(1 - twistedMx));
        var bladeAlpha = smoothstep(0.0, 0.08, m * 0.5 - d + 0.7);
        var shadow = 1 - smoothstep(0.9, 0.2, d);
        var blade = 1.4 * d - bladeAlpha * 0.5;
        var gear = createGear(mx, d, 0.45, 0.52, 0.02);
        var gearCol = 0.5 + 0.5 * createMetalPlate(atan * 1, d);
        blade = mix(mix(shadow, blade, bladeAlpha), gear * 0.3 * gearCol, gear);
        return newCol(blade, blade, blade, bladeAlpha + (1 - shadow));
    });
    return image;
};
var createInnerShadow = function (v) {
    var d = lenV(v) * 2;
    var dm = lenV(subV(v, mulVS(v11, 0.05))) * 2;
    var val = smoothstep(1, 0.5, dm * 0.8) * 0.2;
    var a = smoothstep(1, 0.85, d);
    return newCol(val, val, val, a);
};
var createLedGlass = function (v) {
    var d = (lenV(v) * 2) * 1.2;
    var val = smoothstep(1, 0.0, d) * 0.25;
    var a = smoothstep(0.99, 0.9, d);
    return newCol(val, val, val, a);
};
var createLedGlassReflection = function (v) {
    var d = (lenV(v) * 2) * 1.5;
    var dm = lenV(subV(v, mulVS(v11, 0.14))) * 1.01;
    var val = smoothstep(1, 0.6, d) *
        smoothstep(0.2, 0.5, dm);
    return newCol(val, val, val, val);
};
var createLedSprite = function () { return generateImage(21, 21, function (v) {
    var cv = subV(v, halfV);
    var innerShadow = createInnerShadow(cv);
    var ledGlass = createLedGlass(cv);
    var ledGlassReflection = createLedGlassReflection(cv);
    return addCol(addCol(innerShadow, ledGlass), ledGlassReflection);
}); };
var white = newCol(1, 1, 1, 1);
var createGlow = function (color) { return generateImage(80, 80, function (v) {
    var cv = subV(v, halfV);
    var d = 1 - lenV(cv) * 2;
    var result = mixCol(color, white, smoothstep(0.6, 0.89, d));
    var a = smoothstep(0.0, 1, d);
    return newCol(result.r, result.g, result.b, a * a * a);
}); };
var createMetal = function (a, d) {
    return 0.9 + 0.1 * Math.sin(a * 6) * 0.9 + 0.1 * Math.sin(a * 4)
        - (noise({ x: (a + 4 + d * 5) * 2, y: d * 80 }) * 0.1);
};
var createRingGlow = function (color) { return generateImage(62, 62, function (v) {
    var cv = subV(v, halfV);
    var d = 1 - lenV(cv) * 2;
    var result = mixCol(color, white, smoothstep(0.45, 0.5, d) * smoothstep(0.55, 0.5, d));
    var a = smoothstep(0.0, 0.5, d) * smoothstep(1, 0.5, d);
    return newCol(result.r, result.g, result.b, a * a * a);
}); };
var createConnectorButtons = function (lightColor, size) {
    var shadowBlur = 0.2;
    var shadowDistance = 0.04;
    var shadowScale = 1.1;
    var shadowStrength = 0.2;
    var image = generateImage(size, size, function (v) {
        v = mulVS(v, 1.1); // scale to make room for shadow
        var cv = subV(v, halfV);
        var atan = Math.atan2(cv.y, cv.x);
        var py = lenV(cv) * 2;
        // back
        var backAlpha = smoothstep(1, .96, py);
        var shading = smoothstep(0.9, 0.80, py) * 0.3 + 0.3;
        shading -= smoothstep(0.7, 0.60, py) * smoothstep(0.2, 0.30, py) * 0.4;
        var backVal = createMetal(atan + (shading * 3), py) * shading;
        var backCol = newCol(backVal, backVal, backVal, backAlpha);
        // light
        var lightAlpha = smoothstep(0.35, 0.45, py) * smoothstep(0.55, 0.45, py);
        var col = mixCol(backCol, lightColor, lightAlpha);
        var shadow = smoothstep(1, 1 - shadowBlur, lenV(subV(cv, {
            x: shadowDistance,
            y: shadowDistance
        })) * 2 / shadowScale) * shadowStrength;
        var shadowCol = newCol(0, 0, 0, shadow);
        return mixCol(col, shadowCol, smoothstep(0.8, 1, py));
    });
    return image;
};
var createGameBackground = function () {
    var _a = createCanvas(1920, 1280), canvas = _a[0], context = _a[1];
    var image = generateImage(64, 64, function (v) {
        var m = mulVS(v, 4);
        var col = 1 - smoothstep(0.7, 1, createHexField(m, 1)) * 0.7;
        return newCol(col * 0.117, col * 0.149, col * 0.188, 1);
    });
    var highlight = generateImage(128 * 2, 72 * 2, function (v) {
        var w = 0.01;
        var c = smoothstep(0, w * 0.6, v.x) * smoothstep(1, 1 - w * 0.6, v.x) *
            smoothstep(0, w, v.y) * smoothstep(1, 1 - w, v.y);
        return newCol(1, 1, 1, (1 - c) * 0.04);
    });
    for (var y = 0; y < 12; y++) {
        for (var x = 0; x < 24; x++) {
            context.drawImage(image, x * 54, y * 63);
        }
    }
    context.drawImage(highlight, 0, 0, 1280, 720);
    return canvas;
};
var elementById = function (id) { return document.getElementById(id); };
var titleElement = elementById('title');
var gameElement = elementById('game');
var loadingElement = elementById('loading');
var menuElement = elementById('menu');
var levelDoneElement = elementById('levelDone');
var nextMsg = elementById('nextMsg');
var nextBtn = elementById('nextBtn');
var startBtn = elementById('startBtn');
var continueBtn = elementById('continueBtn');
var contentElement = elementById('content');
var resetElement = elementById('reset');
var resetBtn = elementById('resetBtn');
var levelInfo = elementById('levelInfo');
var nodeInfo = elementById('nodeInfo');
var descriptionElement = elementById('description');
var skipBtn = elementById('skipBtn');
var backBtn = elementById('backBtn');
var saveLevel = function (level) {
    try {
        localStorage.setItem('level', '' + level);
    }
    catch (e) {
        // IE and edge don't support localstorage when opening the file from disk
    }
};
var loadLevel = function () {
    try {
        return parseInt(localStorage.getItem('level')) || 0;
    }
    catch (e) {
        return 0;
    }
};
var removeElement = function (element) {
    element.parentNode.removeChild(element);
};
var fadeTime = 0.4;
var showElement = function (element, onComplete) {
    var elements = Array.isArray(element) ? element : [element];
    elements.forEach(function (e) {
        e.style.visibility = 'visible';
        e.style.opacity = '0';
    });
    tween(0, 1, fadeTime, function (t) {
        elements.forEach(function (e) {
            e.style.opacity = t.toString();
        });
    }, function () {
        onComplete && onComplete();
    });
};
var hideElement = function (element, onComplete) {
    var elements = Array.isArray(element) ? element : [element];
    tween(1, 0, fadeTime, function (t) {
        elements.forEach(function (e) {
            e.style.opacity = t.toString();
        });
    }, function () {
        elements.forEach(function (e) {
            e.style.visibility = 'hidden';
        });
        onComplete && onComplete();
    });
};
// type Mouse = { pos: Vec2, leftDown: boolean; }
// type InputCallback = (() => void) | undefined;
// type InputCallbacks = {
//     mouseOver?: InputCallback;
//     mouseOut?: InputCallback;
//     mouseDown?: InputCallback;
//     mouseUp?: InputCallback;
//     mouseDownUpdate?: InputCallback;
// }
// interface InputControl {
//     mousePos: Vec2;
//     isMouseDown: ()=>boolean;
//     targets: [MouseDragEntity, InputCallbacks][];
//     shutdown(): void;
//     update(): void;
//     dragControl(target: MouseDragEntity, callbacks: InputCallbacks): void;
// }
// const createInputControl = (canvas: Canvas): InputControl => {
//     let mouseDown: boolean = false;
//     const mousePos: Vec2 = {x: 1, y: 1};
//     const mouseOverTargets: [MouseDragEntity, InputCallbacks][] = [];
//     const mouseOutTargets: [MouseDragEntity, InputCallbacks][] = [];
//     const mouseDownTargets: [MouseDragEntity, InputCallbacks][] = [];
//     const mouseMoveListener = (e: MouseEvent) => {
//         let rect = canvas.getBoundingClientRect();
//         mousePos.x = e.clientX - rect.left;
//         mousePos.y = e.clientY - rect.top;
//         e.preventDefault();
//     };
//     const mouseDownListener = (e: MouseEvent) => {
//         mouseDown = true;
//         mouseOverTargets.forEach(watch => {
//             const mouseDownCallback = watch[1].mouseDown;
//             mouseDownCallback && mouseDownCallback();
//             mouseDownTargets.push(watch);
//         });
//         e.preventDefault();
//     };
//     const mouseUpListener = (e: MouseEvent) => {
//         mouseDown = false;
//         mouseDownTargets.forEach(watch => {
//             const mouseUpCallback = watch[1].mouseUp;
//             mouseUpCallback && mouseUpCallback();
//         });
//         mouseDownTargets.length = 0;
//     };
//     document.addEventListener('pointermove', mouseMoveListener);
//     document.addEventListener('pointerdown', mouseDownListener);
//     document.addEventListener('pointerup', mouseUpListener);
//     const dragControl = (target: MouseDragEntity, callbacks: InputCallbacks) => {
//         mouseOutTargets.push([target, callbacks]);
//     };
//     const update = () => {
//         for (let i = mouseOutTargets.length - 1; i >= 0; --i) {
//             const watch = mouseOutTargets[i];
//             const callbacks = watch[1];
//             if (distV(mousePos, watch[0].pos) <= watch[0].mouseDrag.size) {
//                 callbacks.mouseOver && callbacks.mouseOver();
//                 mouseOutTargets.splice(i, 1);
//                 mouseOverTargets.push(watch);
//             }
//         }
//         for (let i = mouseOverTargets.length - 1; i >= 0; --i) {
//             const watch = mouseOverTargets[i];
//             const callbacks = watch[1];
//             mouseDown && callbacks.mouseDownUpdate && callbacks.mouseDownUpdate();
//             if (distV(mousePos, watch[0].pos) > watch[0].mouseDrag.size) {
//                 callbacks.mouseOut && callbacks.mouseOut();
//                 mouseOverTargets.splice(i, 1);
//                 mouseOutTargets.push(watch);
//             }
//         }
//     };
//     const shutdown = () => {
//         document.removeEventListener('pointermove', mouseMoveListener);
//         document.removeEventListener('pointerdown', mouseDownListener);
//         document.removeEventListener('pointerup', mouseUpListener);
//     };
//     return {
//         update,
//         dragControl,
//         mousePos,
//         isMouseDown: () => (mouseDown),
//         shutdown,
//         targets:mouseOverTargets
//     };
// };
var createInputControl = function (canvas) {
    var mouseDown = false;
    var mousePos = { x: 1, y: 1 };
    var mouseOverTargets = [];
    var mouseOutTargets = [];
    var mouseDownTargets = [];
    var mouseMoveListener = function (e) {
        var rect = canvas.getBoundingClientRect();
        mousePos.x = e.clientX - rect.left;
        mousePos.y = e.clientY - rect.top;
        e.preventDefault();
    };
    var mouseDownListener = function (e) {
        mouseDown = true;
        mouseOverTargets.forEach(function (watch) {
            var mouseDownCallback = watch[1].mouseDown;
            mouseDownCallback && mouseDownCallback();
            mouseDownTargets.push(watch);
        });
        e.preventDefault();
    };
    var mouseUpListener = function (e) {
        mouseDown = false;
        mouseDownTargets.forEach(function (watch) {
            var mouseUpCallback = watch[1].mouseUp;
            mouseUpCallback && mouseUpCallback();
        });
        mouseDownTargets.length = 0;
    };
    var touchMoveListener = function (e) {
        if (e.touches.length > 0) {
            var rect = canvas.getBoundingClientRect();
            mousePos.x = e.touches[0].clientX - rect.left;
            mousePos.y = e.touches[0].clientY - rect.top;
            e.preventDefault();
        }
    };
    var touchStartListener = function (e) {
        if (e.touches.length >= 0) {
            mouseDown = true;
            mouseOverTargets.forEach(function (watch) {
                var mouseDownCallback = watch[1].mouseDown;
                mouseDownCallback && mouseDownCallback();
                mouseDownTargets.push(watch);
            });
            e.preventDefault();
        }
    };
    var touchEndListener = function (e) {
        mouseDown = false;
        mouseDownTargets.forEach(function (watch) {
            var mouseUpCallback = watch[1].mouseUp;
            mouseUpCallback && mouseUpCallback();
        });
        mouseDownTargets.length = 0;
    };
    document.addEventListener('mousemove', mouseMoveListener);
    document.addEventListener('mousedown', mouseDownListener);
    document.addEventListener('mouseup', mouseUpListener);
    // Add touch event listeners
    document.addEventListener('touchmove', touchMoveListener);
    document.addEventListener('touchstart', touchStartListener);
    document.addEventListener('touchend', touchEndListener);
    var dragControl = function (target, callbacks) {
        mouseOutTargets.push([target, callbacks]);
    };
    var update = function () {
        for (var i = mouseOutTargets.length - 1; i >= 0; --i) {
            var watch = mouseOutTargets[i];
            var callbacks = watch[1];
            if (distV(mousePos, watch[0].pos) <= watch[0].mouseDrag.size) {
                callbacks.mouseOver && callbacks.mouseOver();
                mouseOutTargets.splice(i, 1);
                mouseOverTargets.push(watch);
            }
        }
        for (var i = mouseOverTargets.length - 1; i >= 0; --i) {
            var watch = mouseOverTargets[i];
            var callbacks = watch[1];
            mouseDown && callbacks.mouseDownUpdate && callbacks.mouseDownUpdate();
            if (distV(mousePos, watch[0].pos) > watch[0].mouseDrag.size) {
                callbacks.mouseOut && callbacks.mouseOut();
                mouseOverTargets.splice(i, 1);
                mouseOutTargets.push(watch);
            }
        }
    };
    var shutdown = function () {
        document.removeEventListener('mousemove', mouseMoveListener);
        document.removeEventListener('mousedown', mouseDownListener);
        document.removeEventListener('mouseup', mouseUpListener);
        // Remove touch event listeners
        document.removeEventListener('touchmove', touchMoveListener);
        document.removeEventListener('touchstart', touchStartListener);
        document.removeEventListener('touchend', touchEndListener);
    };
    return {
        update: update,
        dragControl: dragControl,
        mousePos: mousePos,
        isMouseDown: function () { return mouseDown; },
        shutdown: shutdown,
        targets: mouseOverTargets,
    };
};
var createLevelEditorSystem = function (space, inputControl) {
    var mouseWheelListener = function (e) {
        e.preventDefault();
        var spool = inputControl.targets[0][0].spool || inputControl.targets[0][0].block;
        if (!spool) {
            return;
        }
        var min = 30;
        var max = 160;
        if (spool.type == NodeType.isolator) {
            max = 80;
        }
        if (e.deltaY < 0) {
            spool.size !== max && (spool.size += 10);
        }
        else {
            spool.size !== min && (spool.size -= 10);
        }
    };
    var keydownListener = function (e) {
        if (e.key === '1') {
            var spoolEntity = {
                pos: { x: inputControl.mousePos.x - 1, y: inputControl.mousePos.y },
                spool: { size: 50, type: NodeType.spool },
                render: { type: NodeType.spool },
            };
            // (spoolEntity as any).mouseDrag = {size: 20};
            space.addEntity(spoolEntity);
        }
        if (e.key === '2') {
            var spoolEntity = {
                pos: { x: inputControl.mousePos.x, y: inputControl.mousePos.y },
                block: { size: 50 },
                render: { type: NodeType.block },
            };
            // (spoolEntity as any).mouseDrag = {size: 20};
            space.addEntity(spoolEntity);
        }
        if (e.key === '3') {
            var spoolEntity = {
                pos: { x: inputControl.mousePos.x, y: inputControl.mousePos.y },
                spool: { size: 40, type: NodeType.isolator },
                render: { type: NodeType.isolator },
            };
            // (spoolEntity as any).mouseDrag = {size: 20};
            space.addEntity(spoolEntity);
        }
        if (e.key === 'F2') {
            var level_1 = { spools: [], isolators: [], blocks: [] };
            space.entities.forEach(function (entity) {
                if (entity.spool) {
                    switch (entity.spool.type) {
                        case NodeType.spool:
                            level_1.spools.push([entity.pos.x, entity.pos.y, entity.spool.size]);
                            break;
                        case NodeType.start:
                            level_1.start = [entity.pos.x, entity.pos.y];
                            break;
                        case NodeType.end:
                            level_1.end = [110, 360];
                            break;
                        case NodeType.isolator:
                            level_1.isolators.push([entity.pos.x, entity.pos.y, entity.spool.size]);
                            break;
                    }
                }
                if (entity.finish) {
                    level_1.finish = [entity.pos.x, entity.pos.y];
                }
                if (entity.block) {
                    level_1.blocks.push([entity.pos.x, entity.pos.y, entity.block.size]);
                }
            });
            console.log(JSON.stringify(level_1));
        }
    };
    window.addEventListener('keydown', keydownListener);
    window.addEventListener('wheel', mouseWheelListener);
    return {
        addEntity: function (entity) {
            if (entity.spool) {
                if (entity.spool.type != NodeType.end) {
                    entity.mouseDrag = { size: entity.spool.size };
                }
            }
            if (entity.block) {
                entity.mouseDrag = { size: entity.block.size };
            }
        },
        update: function (time) {
        },
        shutdown: function () {
            window.removeEventListener('keydown', keydownListener);
        }
    };
};
var gameData = {
    levels: [
        // {  LEVEL TEMPLATE
        //     'spools': [[864, 336, 150], [560, 378, 50]],
        //     'isolators': [],
        //     'blocks': [],
        //     'start': [50, 360],
        //     'finish': [1230, 360],
        //     'end': [110, 360]
        // }
        // 1
        {
            'spools': [[460, 207, 70], [468, 516, 70]],
            'isolators': [],
            'blocks': [],
            'start': [50, 360],
            'finish': [1230, 360],
            'end': [110, 360]
        },
        {
            'spools': [[440, 540, 60], [846, 556, 60], [645, 173, 90]],
            'isolators': [],
            'blocks': [[777, 369, 110], [249, 461, 70]],
            'start': [50, 360],
            'finish': [1230, 360],
            'end': [110, 360]
        },
        {
            'spools': [[871, 447, 50], [659, 590, 50], [629, 267, 40]],
            'isolators': [[438, 561, 40], [497, 148, 40]],
            'blocks': [[241, 435, 70], [675, 422, 90], [324, 215, 50]],
            'start': [50, 360],
            'finish': [1230, 360],
            'end': [110, 360]
        },
        {
            'spools': [[872, 496, 130], [508, 234, 60], [508, 486, 60], [871, 190, 130]],
            'isolators': [[234, 525, 40], [237, 182, 40]],
            'blocks': [[667, 288, 60], [669, 427, 60], [593, 132, 60], [597, 588, 60]],
            'start': [50, 360],
            'finish': [1230, 360],
            'end': [110, 360]
        },
        {
            'spools': [[845, 156, 70], [595, 443, 60], [668, 609, 60], [396, 416, 50]],
            'isolators': [[832, 396, 40], [556, 247, 40]],
            'blocks': [[696, 204, 60], [721, 392, 60], [498, 345, 50]],
            'start': [50, 360],
            'finish': [1230, 360],
            'end': [110, 360]
        },
        {
            'spools': [[664, 338, 70], [365, 171, 90], [929, 170, 90], [1011, 559, 80], [372, 558, 90]],
            'isolators': [[729, 561, 40], [1149, 266, 40]],
            'blocks': [[757, 203, 70], [846, 375, 70], [585, 549, 80], [1150, 429, 50]],
            'start': [50, 360],
            'finish': [1230, 360],
            'end': [110, 360]
        },
        {
            'spools': [[502, 259, 60], [508, 458, 60], [979, 356, 50], [346, 573, 60], [319, 141, 60]],
            'isolators': [[724, 361, 40], [720, 142, 40]],
            'blocks': [[609, 353, 60], [379, 451, 50], [848, 360, 70]],
            'start': [50, 360],
            'finish': [1230, 360],
            'end': [110, 360]
        },
        {
            'spools': [[957, 156, 70], [378, 570, 70], [507, 109, 60]],
            'isolators': [[568, 536, 40], [382, 198, 40], [659, 112, 40], [940, 348, 40]],
            'blocks': [[756, 445, 100], [1122, 234, 50]],
            'start': [50, 360],
            'finish': [1230, 360],
            'end': [110, 360]
        },
        {
            'spools': [[629, 130, 40], [811, 482, 50], [385, 491, 50], [386, 317, 50], [976, 569, 40], [844, 139, 60], [1161, 138, 50]],
            'isolators': [[222, 230, 40], [216, 587, 30]],
            'blocks': [[619, 367, 160], [1015, 255, 130]],
            'start': [50, 360],
            'finish': [1230, 360],
            'end': [110, 360]
        },
        {
            'spools': [[922, 509, 150], [257, 552, 60], [201, 200, 50], [509, 519, 50], [520, 134, 50], [937, 257, 50], [1111, 133, 50]],
            'isolators': [[678, 465, 40], [679, 291, 40]],
            'blocks': [[887, 113, 80], [392, 438, 70], [699, 573, 50], [1163, 468, 50]],
            'start': [50, 360],
            'finish': [1230, 360],
            'end': [110, 360]
        },
        {
            'spools': [[228, 193, 150], [326, 563, 80], [557, 209, 70], [785, 199, 50], [1043, 593, 80], [1015, 188, 130], [791, 548, 50], [543, 544, 50], [511, 373, 30], [685, 333, 30]],
            'isolators': [[687, 446, 30], [1205, 455, 30]],
            'blocks': [[442, 116, 50], [982, 400, 50], [1203, 265, 50], [1185, 563, 50], [776, 382, 60], [408, 428, 50]],
            'start': [50, 360],
            'finish': [1230, 360],
            'end': [110, 360]
        },
        {
            'spools': [[669, 355, 80], [668, 187, 50], [666, 70, 30], [668, 514, 50], [673, 653, 30], [473, 361, 50], [852, 353, 50], [986, 348, 30], [335, 361, 30]],
            'isolators': [],
            'blocks': [[804, 476, 50], [552, 244, 60], [857, 174, 90], [489, 541, 80]],
            'start': [50, 360],
            'finish': [1230, 360],
            'end': [110, 360]
        },
        {
            'spools': [[549, 114, 60], [213, 345, 30], [389, 186, 50], [834, 93, 70], [297, 272, 40], [389, 564, 50], [606, 542, 50], [815, 566, 50]],
            'isolators': [],
            'blocks': [[839, 300, 130], [1062, 343, 80], [483, 354, 50], [337, 419, 70], [485, 537, 30], [204, 507, 50]],
            'start': [50, 360],
            'finish': [1230, 360],
            'end': [110, 360]
        },
        {
            'spools': [[402, 380, 90], [758, 379, 90], [890, 195, 50], [324, 166, 50], [1036, 91, 40], [1038, 461, 50], [1055, 622, 40]],
            'isolators': [[600, 100, 40], [595, 617, 40]],
            'blocks': [[159, 251, 50], [733, 156, 70], [886, 553, 80], [988, 303, 80], [1167, 238, 50], [1082, 536, 30]],
            'start': [50, 360],
            'finish': [1230, 360],
            'end': [110, 360]
        },
        {
            'spools': [[647, 360, 160], [326, 233, 30], [462, 111, 30], [646, 71, 30], [819, 120, 30], [932, 277, 30], [930, 468, 30], [809, 602, 30], [626, 644, 30], [438, 579, 30], [334, 404, 30]],
            'isolators': [[188, 119, 30], [192, 568, 30]],
            'blocks': [[1069, 367, 90], [354, 134, 50], [561, 106, 40], [828, 232, 50], [855, 392, 50], [711, 577, 50], [447, 466, 50], [431, 258, 60]],
            'start': [50, 360],
            'finish': [1230, 360],
            'end': [110, 360]
        },
        {
            'spools': [[335, 304, 50], [655, 299, 60], [961, 191, 50], [318, 584, 50], [650, 580, 50], [1007, 591, 50], [346, 115, 40], [1139, 136, 50], [1198, 581, 30], [901, 497, 30]],
            'isolators': [],
            'blocks': [[1090, 294, 70], [985, 487, 40], [765, 482, 60], [846, 192, 50], [538, 149, 50], [1037, 134, 30], [1135, 530, 30]],
            'start': [50, 360],
            'finish': [1230, 360],
            'end': [110, 360]
        },
    ]
};
var createMouseDragSystem = function (inputControl) {
    var sp = { x: 0, y: 0 };
    var spools = [];
    var dragEntity;
    var finishEntity;
    var isDragging = false;
    var isOver = false;
    // Function to handle touch events
    var handleTouchEvents = function (e) {
        var touch = e.touches[0];
        inputControl.mousePos.x = touch.clientX;
        inputControl.mousePos.y = touch.clientY;
        e.preventDefault();
    };
    return {
        addEntity: function (entity) {
            // We need the spools to check if we collide
            if (entity.spool && (entity.spool.type === NodeType.spool || entity.spool.type === NodeType.isolator)) {
                spools.push(entity);
            }
            if (entity.finish) {
                finishEntity = entity;
            }
            if (entity.mouseDrag) {
                inputControl.dragControl(entity, {
                    mouseOver: function () {
                        isOver = true;
                        if (inputControl.isMouseDown()) {
                            return;
                        }
                        document.body.style.cursor = 'pointer';
                        dragEntity = entity;
                        entity.render.hover = true;
                    },
                    mouseOut: function () {
                        document.body.style.cursor = 'default';
                        isOver = false;
                        if (!isDragging) {
                            entity.render.hover = false;
                        }
                    },
                    mouseDown: function () {
                        isDragging = true;
                        copyIntoV(sp, subV(inputControl.mousePos, entity.pos));
                    },
                    mouseUp: function () {
                        isDragging = false;
                        if (!isOver) {
                            entity.render.hover = false;
                        }
                    },
                    mouseDownUpdate: function () { },
                });
            }
        },
        update: function (time) {
            inputControl.update();
            if (!dragEntity) {
                return;
            }
            isDragging && copyIntoV(dragEntity.pos, subV(inputControl.mousePos, sp));
            var v1 = dragEntity.pos;
            // Push away from the border
            v1.x = clamp(v1.x, 0, 1280);
            v1.y = clamp(v1.y, 0, 720);
            // Push end node away from spools
            spools.forEach(function (spool) {
                if (spool === dragEntity) {
                    return;
                }
                var v2 = spool.pos;
                var dist = 10 + spool.spool.size;
                if (distV(v1, v2) < dist) {
                    var dir = normalizeV(subV(v1, v2));
                    if (dir.x === 0 && dir.y === 0) {
                        dir.x = 1;
                    }
                    var v = mulVS(dir, dist);
                    dragEntity.pos = addV(v2, v);
                }
            });
            // Snap to finish
            if (distV(v1, finishEntity.pos) < 30) {
                finishEntity.finish.connected = true;
                copyIntoV(dragEntity.pos, finishEntity.pos);
            }
            else {
                finishEntity.finish.connected = false;
            }
        },
    };
};
var createSpoolRenderSystem = function (resources) {
    var entities = [];
    var coils = resources.coils, blocks = resources.blocks, isolators = resources.isolators, drag = resources.drag, finish = resources.finish, start = resources.start;
    return {
        addEntity: function (entity) {
            if (entity.render) {
                entities.push(entity);
            }
        },
        render: function (context, time) {
            entities.forEach(function (entity) {
                switch (entity.render.type) {
                    case NodeType.spool:
                        context.drawImage(coils[entity.spool.size], entity.pos.x - entity.spool.size - 6, entity.pos.y - entity.spool.size - 6);
                        context.drawImage(resources.led, entity.pos.x - 11, entity.pos.y - 11);
                        if (entity.spool.overpowered) {
                            context.drawImage(resources.redGlow, entity.pos.x - 40, entity.pos.y - 40);
                        }
                        else if (entity.spool.powered) {
                            context.drawImage(resources.greenGlow, entity.pos.x - 40, entity.pos.y - 40);
                        }
                        break;
                    case NodeType.isolator:
                        context.drawImage(isolators[entity.spool.size], entity.pos.x - entity.spool.size - 6, entity.pos.y - entity.spool.size - 6);
                        break;
                    case NodeType.block:
                        context.save();
                        context.translate(entity.pos.x, entity.pos.y);
                        context.rotate(time);
                        var sprite = blocks[entity.block.size];
                        context.drawImage(sprite, -sprite.width / 2, -sprite.height / 2);
                        context.restore();
                        break;
                    case NodeType.finish:
                        context.drawImage(finish, entity.pos.x - 32, entity.pos.y - 32);
                        break;
                    case NodeType.start:
                        context.drawImage(start, entity.pos.x - 24, entity.pos.y - 24);
                        break;
                    case NodeType.end:
                        context.drawImage(drag, entity.pos.x - 32, entity.pos.y - 32);
                        if (entity.render.hover) {
                            context.globalAlpha = 0.8 + (0.2 * Math.sin(time * 6));
                            context.drawImage(resources.dragGlow, entity.pos.x - 31, entity.pos.y - 31);
                        }
                        else {
                            context.globalAlpha = 0.2 + (0.2 * Math.sin(time * 3));
                            context.drawImage(resources.dragGlow, entity.pos.x - 31, entity.pos.y - 31);
                        }
                        context.globalAlpha = 1;
                        break;
                }
            });
        }
    };
};
var createCableRenderSystem = function () {
    var entities = [];
    return {
        addEntity: function (entity) {
            if (entity.cable) {
                entities.push(entity);
            }
        },
        render: function (context) {
            entities.forEach(function (entity) {
                var attachments = entity.cable.attachments;
                for (var i = 0; i < attachments.length - 1; i++) {
                    var a = attachments[i];
                    var b = attachments[i + 1];
                    context.save();
                    if (a.overlap) {
                        context.setLineDash([5, 10]);
                    }
                    if (a.isolated) {
                        context.strokeStyle = '#d04533';
                        context.lineWidth = 5;
                    }
                    else {
                        context.strokeStyle = 'white';
                        context.lineWidth = 3;
                    }
                    context.lineCap = 'round';
                    context.beginPath();
                    context.moveTo(a.outPos.x, a.outPos.y);
                    context.lineTo(b.inPos.x, b.inPos.y);
                    context.stroke();
                    context.restore();
                }
            });
        }
    };
};
var generateResources = function (onProgress, onDone) {
    var resCalls = [];
    var coilSprites = {};
    var blockSprites = {};
    var isolatorSprites = {};
    [30, 40, 50, 60, 70, 80, 90, 100, 110, 120, 130, 140, 150, 160].forEach(function (size) {
        resCalls.push(function () {
            coilSprites[size] = createCoilSprite(size * 2 + 10);
        });
    });
    [30, 40, 50, 60, 70, 80, 90, 100, 110, 120, 130, 140, 150, 160].forEach(function (size) {
        resCalls.push(function () {
            blockSprites[size] = createBlockSprite(size * 2 + 6);
        });
    });
    [30, 40, 50, 60, 70, 80].forEach(function (size) {
        resCalls.push(function () {
            isolatorSprites[size] = createIsolatorSprite(size * 2 + 10);
        });
    });
    var led = createLedSprite();
    var greenGlow = createGlow(newCol(0, 1, 0));
    var redGlow = createGlow(newCol(1, 0, 0));
    var dragPoint = createConnectorButtons(newCol(0.2, 0.6, 0.2), 70);
    var start = createConnectorButtons(newCol(0, 0, 0), 52);
    var dragGlow = createRingGlow(newCol(0, 1, 0));
    var finish = createConnectorButtons(newCol(1, 0.4, 0.4), 70);
    //Tutorial Screens
    var _a = createCanvas(450, 264), tutorial1 = _a[0], tutCtx1 = _a[1];
    tutorial1.className = 'tutorial';
    tutCtx1.font = '20px sans-serif';
    tutCtx1.fillStyle = '#ccc';
    tutCtx1.fillText('1. Drag the cable ...', 20, 50);
    tutCtx1.drawImage(dragPoint, 358, 10);
    tutCtx1.fillText('2. ...around the power nodes...', 20, 140);
    tutCtx1.drawImage(createCoilSprite(80), 350, 90);
    tutCtx1.fillText('3. ...and plug it into the socket!', 20, 230);
    tutCtx1.drawImage(finish, 358, 190);
    var _b = createCanvas(450, 100), tutorial2 = _b[0], tutCtx2 = _b[1];
    tutorial2.className = 'tutorial';
    tutCtx2.font = '20px sans-serif';
    tutCtx2.fillStyle = '#ccc';
    tutCtx2.fillText('Isolated cables can overlap others ', 20, 55);
    tutCtx2.drawImage(createIsolatorSprite(80), 358, 10);
    var numResources = resCalls.length;
    var numGenerated = 0;
    (function nextRes() {
        var nextCall = resCalls.shift();
        if (nextCall) {
            nextCall();
            onProgress(100 / numResources * ++numGenerated);
            requestAnimationFrame(nextRes);
        }
        else {
            onDone({
                coils: coilSprites,
                blocks: blockSprites,
                isolators: isolatorSprites,
                greenGlow: greenGlow,
                redGlow: redGlow,
                led: led,
                drag: dragPoint,
                dragGlow: dragGlow,
                finish: finish,
                tutorial1: tutorial1,
                tutorial2: tutorial2,
                start: start
            });
        }
    })();
};
var createSpace = function () {
    var systems = [];
    var entities = [];
    return {
        registerSystem: function (system) {
            systems.push(system);
        },
        addEntity: function (entity) {
            entities.push(entity);
            systems.forEach(function (system) {
                system.addEntity(entity);
            });
        },
        shutdown: function () {
            systems.forEach(function (system) { return system.shutdown && system.shutdown(); });
        },
        entities: entities
    };
};
var calculateTangents = function (attachments) {
    for (var i = 0; i < attachments.length - 1; i++) {
        var a = attachments[i];
        var b = attachments[i + 1];
        var tangents = getTangents(a.entity.pos, a.entity.spool.size, b.entity.pos, b.entity.spool.size);
        var idx = a.side == Side.left ? b.side == Side.left ? 1 : 3 : b.side == Side.left ? 2 : 0;
        if (!tangents[idx]) {
        }
        a.outPos = tangents[idx][0];
        b.inPos = tangents[idx][1];
    }
};
var getIntersections = function (a, b, spoolEntities, ignoreA, ignoreB) {
    return spoolEntities
        .filter(function (spoolEntity) {
        return (spoolEntity != ignoreA && spoolEntity != ignoreB) &&
            lineCircleIntersect(a, b, spoolEntity.pos, spoolEntity.spool.size);
    })
        .sort(function (ca, cb) { return dist2(ca.pos, a) > dist2(cb.pos, a) ? 1 : -1; }); //TODO: need to add the radius
};
var resolveConnections = function (attachments, spools) {
    var resolved;
    do {
        resolved = true;
        for (var i = 0; i < attachments.length - 1; i++) {
            var a = attachments[i];
            var b = attachments[i + 1];
            var entity = getIntersections(a.outPos, b.inPos, spools, a.entity, b.entity)[0];
            if (entity) {
                if (entity.spool.isAttached) {
                    // node already connected
                    a.overlap = true;
                }
                else {
                    // we have a connection
                    entity.spool.isAttached = true;
                    var side = sideOfLine(a.outPos, b.inPos, entity.pos);
                    var attachment = { entity: entity, side: side };
                    attachments.splice(i + 1, 0, attachment);
                    resolved = false;
                    calculateTangents([a, attachment, b]);
                    break;
                }
            }
        }
    } while (!resolved);
};
var resolveDisconnections = function (attachments) {
    var resolved;
    do {
        resolved = true;
        for (var i = 1; i < attachments.length - 1; i++) {
            var a = attachments[i - 1];
            var b = attachments[i];
            var c = attachments[i + 1];
            var vAB = subV(a.outPos, b.inPos);
            var vBC = subV(b.outPos, c.inPos);
            var angle = Math.atan2(vBC.y, vBC.x) - Math.atan2(vAB.y, vAB.x);
            if (angle < 0)
                angle += 2 * Math.PI;
            if ((b.side == Side.left && angle > Math.PI * 1.8) ||
                (b.side == Side.right && angle < Math.PI * 0.2)) {
                attachments.splice(i, 1);
                b.entity.spool.isAttached = false;
                resolved = false;
                calculateTangents([a, c]);
                break;
            }
        }
    } while (!resolved);
};
var createSpoolSystem = function (onLevelCompleted) {
    var spoolEntities = [];
    var blockEntities = [];
    var cables = [];
    var finishEntity;
    var lastPoweredSpools = 0;
    var numSpools = 0;
    return {
        addEntity: function (entity) {
            if (entity.spool) {
                spoolEntities.push(entity);
                if (entity.spool.type == NodeType.spool) {
                    numSpools++;
                    nodeInfo.innerHTML = 0 + ' / ' + numSpools;
                }
            }
            if (entity.cable) {
                cables.push(entity);
            }
            if (entity.block) {
                blockEntities.push(entity);
            }
            if (entity.finish) {
                finishEntity = entity;
            }
        },
        update: function (time) {
            cables.forEach(function (cable) {
                var attachments = cable.cable.attachments;
                // reset states
                cable.cable.overpowered = false;
                attachments.forEach(function (attachment) {
                    attachment.overlap = false;
                });
                spoolEntities.forEach(function (spool) {
                    spool.spool.powered = spool.spool.overpowered = false;
                });
                var numPoweredSpools = 0;
                calculateTangents(attachments);
                resolveConnections(attachments, spoolEntities);
                resolveDisconnections(attachments);
                // set isolated status
                var isIsolated = false;
                cable.cable.attachments.forEach(function (attachment) {
                    var spool = attachment.entity.spool;
                    if (spool.type == NodeType.isolator) {
                        isIsolated = !isIsolated;
                    }
                    attachment.isolated = isIsolated;
                });
                // check line overlap
                for (var i = 0; i < attachments.length - 1; i++) {
                    var a1 = attachments[i];
                    var b1 = attachments[i + 1];
                    if (a1.isolated) {
                        continue;
                    }
                    for (var j = 0; j < attachments.length - 1; j++) {
                        var a2 = attachments[j];
                        var b2 = attachments[j + 1];
                        if (a2.isolated) {
                            continue;
                        }
                        if (lineLineIntersect(a1.outPos, b1.inPos, a2.outPos, b2.inPos)) {
                            a1.overlap = a2.overlap = true;
                        }
                    }
                }
                // check block collision
                for (var i = 0; i < attachments.length - 1; i++) {
                    var a1 = attachments[i];
                    var b1 = attachments[i + 1];
                    for (var j = 0; j < blockEntities.length; j++) {
                        if (lineCircleIntersect(a1.outPos, b1.inPos, blockEntities[j].pos, blockEntities[j].block.size)) {
                            a1.overlap = true;
                            cable.cable.overpowered = true;
                        }
                    }
                }
                // check power / overpower
                var hasPower = true;
                cable.cable.attachments.every(function (attachment) {
                    if (!hasPower) {
                        return false;
                    }
                    if (attachment.isolated && !attachment.overlap) {
                        return true;
                    }
                    if (attachment.entity.spool.powered) {
                        attachment.entity.spool.overpowered = true;
                        cable.cable.overpowered = true;
                        return false;
                    }
                    attachment.entity.spool.powered = true;
                    if (attachment.overlap) {
                        hasPower = false;
                    }
                    else if (attachment.entity.spool.type == NodeType.spool) {
                        numPoweredSpools++;
                    }
                    return true;
                });
                // check if level is completed
                if (hasPower && finishEntity.finish.connected && !cable.cable.overpowered && numPoweredSpools === numSpools) {
                    onLevelCompleted();
                }
                if (numPoweredSpools != lastPoweredSpools) {
                    nodeInfo.innerHTML = numPoweredSpools + ' / ' + numSpools;
                }
                lastPoweredSpools = numPoweredSpools;
            });
        }
    };
};
var Side;
(function (Side) {
    Side[Side["left"] = -1] = "left";
    Side[Side["right"] = 1] = "right";
})(Side || (Side = {}));
var NodeType;
(function (NodeType) {
    NodeType[NodeType["spool"] = 0] = "spool";
    NodeType[NodeType["start"] = 1] = "start";
    NodeType[NodeType["end"] = 2] = "end";
    NodeType[NodeType["block"] = 3] = "block";
    NodeType[NodeType["finish"] = 4] = "finish";
    NodeType[NodeType["isolator"] = 5] = "isolator";
})(NodeType || (NodeType = {}));
// TODO: do i need to differentiate between NodeEntity and Entity?! don't think so, remove NodeEntity
/*
    Start
        HasPosition
        StartNode
        Spool
    End
        HasPosition
        Spool
        MouseEvents
        DragConnector
     Finish
        HasPosition
        FinishNode
     Spool
        HasPosition
        Spool



 */
var nextFrame = requestAnimationFrame;
var startFrameLoop = function (callback) {
    var requestId;
    var stopLoop = false;
    var lastTime = 0;
    var update = function (time) {
        callback(time * 0.001);
        if (!stopLoop) {
            requestId = nextFrame(update);
        }
        lastTime = time;
    };
    requestId = nextFrame(update);
    return function () {
        stopLoop = true;
    };
};
var tween = function (from, to, duration, onUpdate, onComplete) {
    var startTime = performance.now();
    var update = function (time) {
        var t = 1 / duration * (time - startTime) * 0.001;
        if (t < 1) {
            onUpdate(from + (to - from) * t);
            nextFrame(update);
        }
        else {
            onUpdate(to);
            nextFrame(onComplete);
        }
    };
    update(startTime);
};
/// <reference path="types.ts" />
/// <reference path="utils.ts" />
/// <reference path="math-util.ts" />
/// <reference path="html.ts" />
/// <reference path="resources.ts" />
/// <reference path="game.ts" />
var showEndScreen = function () {
    nextMsg.innerHTML = 'Thanks for playing!';
    nextBtn.innerHTML = 'AGAIN';
    showElement(levelDoneElement, function () {
        nextBtn.addEventListener('click', function (e) {
            location.reload();
        });
    });
    saveLevel(0);
};
var startGame = function (parent, resources, startLevel) {
    var game = createGame();
    var currentLevel = startLevel;
    var startNextLevel = function () {
        console.log('start level ' + currentLevel);
        var tutorial;
        if (currentLevel == 0) {
            tutorial = resources.tutorial1;
            gameElement.appendChild(tutorial);
            showElement(tutorial);
        }
        if (currentLevel == 2) {
            tutorial = resources.tutorial2;
            gameElement.appendChild(tutorial);
            showElement(tutorial);
        }
        var level = game.createLevel(gameData.levels[currentLevel], resources, function () {
            if (tutorial) {
                hideElement(tutorial, function () {
                    removeElement(tutorial);
                });
            }
            if (currentLevel < gameData.levels.length - 1) {
                currentLevel++;
                saveLevel(currentLevel);
                hideElement(resetElement);
                showElement([levelDoneElement], function () {
                    nextBtn.onclick = function () {
                        nextBtn.onclick = null;
                        hideElement([levelDoneElement, level.canvas, levelInfo, nodeInfo], function () {
                            removeElement(level.canvas);
                            startNextLevel();
                        });
                    };
                });
            }
            else {
                showEndScreen();
            }
        });
        parent.appendChild(level.canvas);
        levelInfo.innerHTML = 'Level ' + (currentLevel + 1);
        showElement([level.canvas, resetElement, levelInfo, nodeInfo]);
        var resetLevel = function () {
            if (tutorial) {
                hideElement(tutorial, function () {
                    removeElement(tutorial);
                });
            }
            backBtn.onclick = skipBtn.onclick = resetBtn.onclick = null;
            hideElement([level.canvas, resetElement, levelInfo, nodeInfo], function () {
                level.shutdown();
                removeElement(level.canvas);
                startNextLevel();
            });
        };
        resetBtn.onclick = resetLevel;
        skipBtn.onclick = function () {
            if (currentLevel > gameData.levels.length - 2) {
                return;
            }
            currentLevel++;
            resetLevel();
        };
        backBtn.onclick = function () {
            if (currentLevel < 1) {
                return;
            }
            currentLevel--;
            resetLevel();
        };
    };
    startNextLevel();
};
var prepareGame = function () {
    var _a = createCanvas(200, 7), loadingBar = _a[0], context = _a[1];
    loadingBar.id = 'loadingbar';
    loadingElement.appendChild(loadingBar);
    showElement(loadingBar);
    context.strokeStyle = 'grey';
    context.fillStyle = 'grey';
    context.lineWidth = 1;
    context.strokeRect(0.5, 0.5, 199, 4);
    generateResources(function (p) {
        context.fillRect(0.5, 0.5, 199 / 100 * p, 4);
    }, function (resources) {
        hideElement(loadingBar, function () {
            showElement([menuElement, descriptionElement]);
            var savedLevel = loadLevel();
            continueBtn.style.visibility = savedLevel ? 'visible' : 'hidden';
            var hideUIandStartGame = function (startLevel) {
                startBtn.onclick = continueBtn.onclick = null;
                hideElement([titleElement, menuElement, descriptionElement], function () {
                    startGame(contentElement, resources, startLevel);
                });
            };
            startBtn.onclick = function () {
                saveLevel(0);
                hideUIandStartGame(0);
            };
            continueBtn.onclick = function () {
                hideUIandStartGame(savedLevel);
            };
            // hideUIandStartGame(10); // skip main menu and start with level
        });
    });
};
showElement(titleElement, prepareGame);
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYXBwLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vc3JjL2NhbnZhcy50cyIsIi4uL3NyYy9nYW1lLnRzIiwiLi4vc3JjL21hdGgtdXRpbC50cyIsIi4uL3NyYy92ZWN0b3IudHMiLCIuLi9zcmMvZ2Z4LWdlbmVyYXRvci50cyIsIi4uL3NyYy9odG1sLnRzIiwiLi4vc3JjL2lucHV0LnRzIiwiLi4vc3JjL2xldmVsLWVkaXRvci50cyIsIi4uL3NyYy9sZXZlbC50cyIsIi4uL3NyYy9tb3VzZS1kcmFnLXN5c3RlbS50cyIsIi4uL3NyYy9yZW5kZXItc3lzdGVtcy50cyIsIi4uL3NyYy9yZXNvdXJjZXMudHMiLCIuLi9zcmMvc3BhY2UudHMiLCIuLi9zcmMvc3Bvb2wtc3lzdGVtLnRzIiwiLi4vc3JjL3R5cGVzLnRzIiwiLi4vc3JjL3V0aWxzLnRzIiwiLi4vc3JjL3N0YXJ0LnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7QUFBQSxJQUFNLFlBQVksR0FBRyxVQUFDLEtBQWEsRUFBRSxNQUFjO0lBQy9DLElBQU0sTUFBTSxHQUFHLFFBQVEsQ0FBQyxhQUFhLENBQUMsUUFBUSxDQUFDLENBQUM7SUFDaEQsTUFBTSxDQUFDLEtBQUssR0FBRyxLQUFLLENBQUM7SUFDckIsTUFBTSxDQUFDLE1BQU0sR0FBRyxNQUFNLENBQUM7SUFDdkIsSUFBTSxPQUFPLEdBQUcsTUFBTSxDQUFDLFVBQVUsQ0FBQyxJQUFJLENBQVksQ0FBQztJQUNuRCxPQUFPLENBQUMsTUFBTSxFQUFFLE9BQU8sQ0FBQyxDQUFDO0FBQzdCLENBQUMsQ0FBQztBQ05GLElBQU0sVUFBVSxHQUFHO0lBRWYsSUFBTSxVQUFVLEdBQUcsb0JBQW9CLEVBQUUsQ0FBQztJQUUxQyxJQUFNLFdBQVcsR0FBRyxVQUFDLFNBQW9CLEVBQUUsU0FBb0IsRUFBRSxhQUF5QjtRQUVoRixJQUFBLDRCQUEyQyxFQUExQyxjQUFNLEVBQUUsZUFBTyxDQUE0QjtRQUNsRCxJQUFNLEtBQUssR0FBRyxXQUFX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QUFDLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDLEdBQUcsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsS0FBSyxFQUExRixDQUEwRixDQUFDO0FDbEdySixxQ0FBcUM7QUFDckMsSUFBTSxLQUFLLEdBQUcsVUFBQyxDQUFRLElBQU0sT0FBQSxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxHQUFHLENBQUMsRUFBakIsQ0FBaUIsQ0FBQztBQUUvQyxJQUFNLElBQUksR0FBRyxVQUFDLEVBQVEsRUFBRSxFQUFRLElBQVcsT0FBQSxDQUFDLEVBQUMsQ0FBQyxFQUFFLEVBQUUsQ0FBQyxDQUFDLEdBQUcsRUFBRSxDQUFDLENBQUMsRUFBRSxDQUFDLEVBQUUsRUFBRSxDQUFDLENBQUMsR0FBRyxFQUFFLENBQUMsQ0FBQyxFQUFDLENBQUMsRUFBbEMsQ0FBa0MsQ0FBQztBQUM5RSxJQUFNLElBQUksR0FBRyxVQUFDLEVBQVEsRUFBRSxFQUFRLElBQVcsT0FBQSxDQUFDLEVBQUMsQ0FBQyxFQUFFLEVBQUUsQ0FBQyxDQUFDLEdBQUcsRUFBRSxDQUFDLENBQUMsRUFBRSxDQUFDLEVBQUUsRUFBRSxDQUFDLENBQUMsR0FBRyxFQUFFLENBQUMsQ0FBQyxFQUFDLENBQUMsRUFBbEMsQ0FBa0MsQ0FBQztBQUM5RSxJQUFNLEtBQUssR0FBRyxVQUFDLENBQU8sRUFBRSxDQUFTLElBQVcsT0FBQSxDQUFDLEVBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsRUFBQyxDQUFDLEVBQTFCLENBQTBCLENBQUM7QUFDdkUsSUFBTSxLQUFLLEdBQUcsVUFBQyxDQUFPLEVBQUUsQ0FBUyxJQUFXLE9BQUEsS0FBSyxDQUFDLENBQUMsRUFBRSxDQUFDLEdBQUcsQ0FBQyxDQUFDLEVB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LEVBQUUsR0FBRyxJQUFJLENBQUMsQ0FBQyxFQUFFLEtBQUssQ0FBQyxDQUFDO0lBQzFCLElBQU0sQ0FBQyxHQUFHLENBQUMsR0FBRyxJQUFJLENBQUMsRUFBRSxDQUFDLEdBQUcsQ0FBQyxDQUFDO0lBQzNCLElBQU0sTUFBTSxHQUFHLE1BQU0sQ0FBQyxLQUFLLEVBQUUsS0FBSyxFQUFFLFVBQVUsQ0FBQyxHQUFHLEVBQUUsSUFBSSxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUM7SUFFOUQsSUFBTSxDQUFDLEdBQUcsVUFBVSxDQUFDLEdBQUcsRUFBRSxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUM7SUFDaEMsT0FBTyxNQUFNLENBQUMsTUFBTSxDQUFDLENBQUMsRUFBRSxNQUFNLENBQUMsQ0FBQyxFQUFFLE1BQU0sQ0FBQyxDQUFDLEVBQUUsQ0FBQyxHQUFDLENBQUMsR0FBQyxDQUFDLENBQUMsQ0FBQztBQUN2RCxDQUFDLENBQUMsRUFQMEMsQ0FPMUMsQ0FBQztBQUVILElBQU0sV0FBVyxHQUFHLFVBQUMsQ0FBUyxFQUFFLENBQVM7SUFDckMsT0FBTyxHQUFHLEdBQUcsR0FBRyxHQUFHLElBQUksQ0FBQyxHQUFHLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxHQUFHLEdBQUcsR0FBRyxHQUFHLEdBQUcsSUFBSSxDQUFDLEdBQUcsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDO1VBQzFELENBQUMsS0FBSyxDQUFDLEVBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxHQUFHLENBQUMsR0FBRyxDQUFDLEdBQUcsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLEdBQUcsRUFBRSxFQUFDLENBQUMsR0FBRyxHQUFHLENBQUMsQ0FBQztBQUM3RCxDQUFDLENBQUM7QUFFRixJQUFNLGNBQWMsR0FBRyxVQUFDLEtBQVcsSUFBYSxPQUFBLGFBQWEsQ0FBQyxFQUFFLEVBQUUsRUFBRSxFQUFFLFVBQUEsQ0FBQztJQUNuRSxJQUFNLEVBQUUsR0FBRyxJQUFJLENBQUMsQ0FBQyxFQUFFLEtBQUssQ0FB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R0FBRyxFQUFFLEVBQUUsQ0FBQyxFQUFFLENBQUMsR0FBRyxFQUFFLEdBQUcsRUFBRSxFQUFFLENBQUMsQ0FBQztZQUMxRCxXQUFXLEVBQUUsQ0FBQyxDQUFDLEdBQUcsRUFBRSxHQUFHLEVBQUUsRUFBRSxDQUFDLEVBQUUsQ0FBQyxHQUFHLEVBQUUsR0FBRyxFQUFFLEVBQUUsQ0FBQyxDQUFDO1lBQzdDLFFBQVEsRUFBRSxDQUFDLENBQUMsR0FBRyxFQUFFLEdBQUcsRUFBRSxFQUFFLENBQUMsRUFBRSxDQUFDLEdBQUcsRUFBRSxHQUFHLEVBQUUsRUFBRSxDQUFDLEVBQUUsQ0FBQyxHQUFHLEVBQUUsR0FBRyxFQUFFLEVBQUUsQ0FBQyxDQUFDO1lBQzFELE9BQU8sRUFBRSxDQUFDLEVBQUUsRUFBRSxHQUFHLENBQUM7WUFDbEIsUUFBUSxFQUFFLENBQUMsSUFBSSxFQUFFLEdBQUcsQ0FBQztZQUNyQixLQUFLLEVBQUUsQ0FBQyxHQUFHLEVBQUUsR0FBRyxDQUFDO1NBQ3BCO1FBQ0Q7WUFDSSxRQUFRLEVBQUUsQ0FBQyxDQUFDLEdBQUcsRUFBRSxHQUFHLEVBQUUsR0FBRyxDQUFDLEVBQUUsQ0FBQyxHQUFHLEVBQUUsR0FBRyxFQUFFLEVBQUUsQ0FBQyxFQUFFLENBQUMsR0FBRyxFQUFFLEdBQUcsRUFBRSxFQUFFLENBQUMsRUFBRSxDQUFDLEdBQUcsRUFBRSxHQUFHLEVBQUUsR0FBRyxDQUFDLENBQUM7WUFDNUUsV0FBVyxFQUFFLENBQUMsQ0FBQyxHQUFHLEVBQUUsR0FBRyxFQUFFLEVBQUUsQ0FBQyxFQUFFLENBQUMsR0FBRyxFQUFFLEdBQUcsRUFBRSxFQUFFLENBQUMsQ0FBQztZQUM3QyxRQUFRLEVBQUUsQ0FBQyxDQUFDLEdBQUcsRUFBRSxHQUFHLEVBQUUsRUFBRSxDQUFDLEVBQUUsQ0FBQyxHQUFHLEVBQUUsR0FBRyxFQUFFLEVBQUUsQ0FBQyxFQUFFLENBQUMsR0FBRyxFQUFFLEdBQUcsRUFBRSxFQUFFLENBQUMsRUFBRSxDQUFDLEdBQUcsRUFBRSxHQUFHLEVBQUUsRUFBRSxDQUFDLENBQUM7WUFDMUUsT0FBTyxFQUFFLENBQUMsRUFBRSxFQUFFLEdBQUcsQ0FBQztZQUNsQixRQUFRLEVBQUUsQ0FBQyxJQUFJLEVBQUUsR0FBRyxDQUFDO1lBQ3JCLEtBQUssRUFBRSxDQUFDLEdBQUcsRUFBRSxHQUFHLENBQUM7U0FDcEI7UUFDRDtZQUNJLFFBQVEsRUFBRSxDQUFDLENBQUMsR0FBRyxFQUFFLEdBQUcsRUFBRSxFQUFFLENBQUMsRUFBRSxDQUFDLEdBQUcsRUFBRSxHQUFHLEVBQUUsRUFBRSxDQUFDLEVBQUUsQ0FBQyxHQUFHLEVBQUUsR0FBRyxFQUFFLEVBQUUsQ0FBQyxFQUFFLENBQUMsR0FBRyxFQUFFLEdBQUcsRUFBRSxFQUFFLENBQUMsQ0FBQztZQUMxRSxXQUFXLEVBQUUsQ0FBQyxDQUFDLEdBQUcsRUFBRSxHQUFHLEVBQUUsRUFBRSxDQUFDLEVBQUUsQ0FBQyxHQUFHLEVBQUUsR0FBRyxFQUFFLEVBQUUsQ0FBQyxDQUFDO1lBQzdDLFFBQVEsRUFBRSxDQUFDLENBQUMsR0FBRyxFQUFFLEdBQUcsRUFBRSxFQUFFLENBQUMsRUFBRSxDQUFDLEdBQUcsRUFBRSxHQUFHLEVBQUUsRUFBRSxDQUFDLEVBQUUsQ0FBQyxHQUFHLEVBQUUsR0FBRyxFQUFFLEVBQUUsQ0FBQyxDQUFDO1lBQzFELE9BQU8sRUFBRSxDQUFDLEVBQUUsRUFBRSxHQUFHLENBQUM7WUFDbEIsUUFBUSxFQUFFLENBQUMsSUFBSSxFQUFFLEdBQUcsQ0FBQztZQUNyQixLQUFLLEVBQUUsQ0FBQyxHQUFHLEVBQUUsR0FBRyxDQUFDO1NBQ3BCO1FBQ0Q7WUFDSSxRQUFRLEVBQUUsQ0FBQyxDQUFDLEdBQUcsRUFBRSxHQUFHLEVBQUUsRUFBRSxDQUFDLEVBQUUsQ0FBQyxHQUFHLEVBQUUsR0FBRyxFQUFFLEVBQUUsQ0FBQyxFQUFFLENBQUMsR0FBRyxFQUFFLEdBQUcsRUFBRSxFQUFFLENBQUMsRUFBRSxDQUFDLElBQUksRUFBRSxHQUFHLEVBQUUsRUFBRSxDQUFDLEVBQUUsQ0FBQyxHQUFHLEVBQUUsR0FBRyxFQUFFLEVBQUUsQ0FBQyxDQUFDO1lBQzNGLFdBQVcsRUFBRSxDQUFDLENBQUMsR0FBRyxFQUFFLEdBQUcsRUFBRSxFQUFFLENBQUMsRUFBRSxDQUFDLElBQUksRUFBRSxHQUFHLEVBQUUsRUFBRSxDQUFDLENBQUM7WUFDOUMsUUFBUSxFQUFFLENBQUMsQ0FBQyxHQUFHLEVBQUUsR0FBRyxFQUFFLEVBQUUsQ0FBQyxFQUFFLENBQUMsR0FBRyxFQUFFLEdBQUcsRUFBRSxFQUFFLENBQUMsRUFBRSxDQUFDLEdBQUcsRUFBRSxHQUFHLEVBQUUsRUFBRSxDQUFDLEVBQUUsQ0FBQyxJQUFJLEVBQUUsR0FBRyxFQUFFLEVBQUUsQ0FBQyxDQUFDO1lBQzNFLE9BQU8sRUFBRSxDQUFDLEVBQUUsRUFBRSxHQUFHLENBQUM7WUFDbEIsUUFBUSxFQUFFLENBQUMsSUFBSSxFQUFFLEdBQUcsQ0FBQztZQUNyQixLQUFLLEVBQUUsQ0FBQyxHQUFHLEVBQUUsR0FBRyxDQUFDO1NBQ3BCO1FBQ0Q7WUFDSSxRQUFRLEVBQUUsQ0FBQyxDQUFDLEdBQUcsRUFBRSxHQUFHLEVBQUUsRUFBRSxDQUFDLEVBQUUsQ0FBQyxHQUFHLEVBQUUsR0FBRyxFQUFFLEVBQUUsQ0FBQyxFQUFFLENBQUMsR0FBRyxFQUFFLEdBQUcsRUFBRSxFQUFFLENBQUMsRUFBRSxDQUFDLEdBQUcsRUFBRSxHQUFHLEVBQUUsRUFBRSxDQUFDLEVBQUUsQ0FBQyxHQUFHLEVBQUUsR0FBRyxFQUFFLEVBQUUsQ0FBQyxDQUFDO1lBQzFGLFdBQVcsRUFBRSxDQUFDLENBQUMsR0FBRyxFQUFFLEdBQUcsRUFBRSxFQUFFLENBQUMsRUFBRSxDQUFDLEdBQUcsRUFBRSxHQUFHLEVBQUUsRUFBRSxDQUFDLENBQUM7WUFDN0MsUUFBUSxFQUFFLENBQUMsQ0FBQyxHQUFHLEVBQUUsR0FBRyxFQUFFLEVBQUUsQ0FBQyxFQUFFLENBQUMsR0FBRyxFQUFFLEdBQUcsRUFBRSxFQUFFLENBQUMsRUFBRSxDQUFDLEdBQUcsRUFBRSxHQUFHLEVBQUUsRUFBRSxDQUFDLENBQUM7WUFDMUQsT0FBTyxFQUFFLENBQUMsRUFBRSxFQUFFLEdBQUcsQ0FBQztZQUNsQixRQUFRLEVBQUUsQ0FBQyxJQUFJLEVBQUUsR0FBRyxDQUFDO1lBQ3JCLEtBQUssRUFBRSxDQUFDLEdBQUcsRUFBRSxHQUFHLENBQUM7U0FDcEI7UUFDRDtZQUNJLFFBQVEsRUFBRSxDQUFDLENBQUMsR0FBRyxFQUFFLEdBQUcsRUFBRSxFQUFFLENBQUMsRUFBRSxDQUFDLEdBQUcsRUFBRSxHQUFHLEVBQUUsRUFBRSxDQUFDLEVBQUUsQ0FBQyxHQUFHLEVBQUUsR0FBRyxFQUFFLEVBQUUsQ0FBQyxDQUFDO1lBQzFELFdBQVcsRUFBRSxDQUFDLENBQUMsR0FBRyxFQUFFLEdBQUcsRUFBRSxFQUFFLENBQUMsRUFBRSxDQUFDLEdBQUcsRUFBRSxHQUFHLEVBQUUsRUFBRSxDQUFDLEVBQUUsQ0FBQyxHQUFHLEVBQUUsR0FBRyxFQUFFLEVBQUUsQ0FBQyxFQUFFLENBQUMsR0FBRyxFQUFFLEdBQUcsRUFBRSxFQUFFLENBQUMsQ0FBQztZQUM3RSxRQUFRLEVBQUUsQ0FBQyxDQUFDLEdBQUcsRUFBRSxHQUFHLEVBQUUsR0FBRyxDQUFDLEVBQUUsQ0FBQyxJQUFJLEVBQUUsR0FBRyxFQUFFLEVBQUUsQ0FBQyxDQUFDO1lBQzVDLE9BQU8sRUFBRSxDQUFDLEVBQUUsRUFBRSxHQUFHLENBQUM7WUFDbEIsUUFBUSxFQUFFLENBQUMsSUFBSSxFQUFFLEdBQUcsQ0FBQztZQUNyQixLQUFLLEVBQUUsQ0FBQyxHQUFHLEVBQUUsR0FBRyxDQUFDO1NBQ3BCO1FBQ0Q7WUFDSSxRQUFRLEVBQUUsQ0FBQyxDQUFDLEdBQUcsRUFBRSxHQUFHLEVBQUUsRUFBRSxDQUFDLEVBQUUsQ0FBQyxHQUFHLEVBQUUsR0FBRyxFQUFFLEVBQUUsQ0FBQyxFQUFFLENBQUMsR0FBRyxFQUFFLEdBQUcsRUFBRSxFQUFFLENBQUMsRUFBRSxDQUFDLEdBQUcsRUFBRSxHQUFHLEVBQUUsRUFBRSxDQUFDLEVBQUUsQ0FBQyxHQUFHLEVBQUUsR0FBRyxFQUFFLEVBQUUsQ0FBQyxFQUFFLENBQUMsR0FBRyxFQUFFLEdBQUcsRUFBRSxFQUFFLENBQUMsRUFBRSxDQUFDLElBQUksRUFBRSxHQUFHLEVBQUUsRUFBRSxDQUFDLENBQUM7WUFDM0gsV0FBVyxFQUFFLENBQUMsQ0FBQyxHQUFHLEVBQUUsR0FBRyxFQUFFLEVBQUUsQ0FBQyxFQUFFLENBQUMsR0FBRyxFQUFFLEdBQUcsRUFBRSxFQUFFLENBQUMsQ0FBQztZQUM3QyxRQUFRLEVBQUUsQ0FBQyxDQUFDLEdBQUcsRUFBRSxHQUFHLEVBQUUsR0FBRyxDQUFDLEVBQUUsQ0FBQyxJQUFJLEVBQUUsR0FBRyxFQUFFLEdBQUcsQ0FBQyxDQUFDO1lBQzdDLE9BQU8sRUFBRSxDQUFDLEVBQUUsRUFBRSxHQUFHLENBQUM7WUFDbEIsUUFBUSxFQUFFLENBQUMsSUFBSSxFQUFFLEdBQUcsQ0FBQztZQUNyQixLQUFLLEVBQUUsQ0FBQyxHQUFHLEVBQUUsR0FBRyxDQUFDO1NBQ3BCO1FBQ0Q7WUFDSSxRQUFRLEVBQUUsQ0FBQyxDQUFDLEdBQUcsRUFBRSxHQUFHLEVBQUUsR0FBRyxDQUFDLEVBQUUsQ0FBQyxHQUFHLEVBQUUsR0FBRyxFQUFFLEVBQUUsQ0FBQyxFQUFFLENBQUMsR0FBRyxFQUFFLEdBQUcsRUFBRSxFQUFFLENBQUMsRUFBRSxDQUFDLEdBQUcsRUFBRSxHQUFHLEVBQUUsRUFBRSxDQUFDLEVBQUUsQ0FBQyxHQUFHLEVBQUUsR0FBRyxFQUFFLEVBQUUsQ0FBQyxFQUFFLENBQUMsR0FBRyxFQUFFLEdBQUcsRUFBRSxFQUFFLENBQUMsRUFBRSxDQUFDLElBQUksRUFBRSxHQUFHLEVBQUUsRUFBRSxDQUFDLENBQUM7WUFDNUgsV0FBVyxFQUFFLENBQUMsQ0FBQyxHQUFHLEVBQUUsR0FBRyxFQUFFLEVBQUUsQ0FBQyxFQUFFLENBQUMsR0FBRyxFQUFFLEdBQUcsRUFBRSxFQUFFLENBQUMsQ0FBQztZQUM3QyxRQUFRLEVBQUUsQ0FBQyxDQUFDLEdBQUcsRUFBRSxHQUFHLEVBQUUsRUFBRSxDQUFDLEVBQUUsQ0FBQyxHQUFHLEVBQUUsR0FBRyxFQUFFLEVBQUUsQ0FBQyxFQUFFLENBQUMsR0FBRyxFQUFFLEdBQUcsRUFBRSxFQUFFLENBQUMsRUFBRSxDQUFDLElBQUksRUFBRSxHQUFHLEVBQUUsRUFBRSxDQUFDLENBQUM7WUFDM0UsT0FBTyxFQUFFLENBQUMsRUFBRSxFQUFFLEdBQUcsQ0FBQztZQUNsQixRQUFRLEVBQUUsQ0FBQyxJQUFJLEVBQUUsR0FBRyxDQUFDO1lBQ3JCLEtBQUssRUFBRSxDQUFDLEdBQUcsRUFBRSxHQUFHLENBQUM7U0FDcEI7UUFDRDtZQUNJLFFBQVEsRUFBRSxDQUFDLENBQUMsR0FBRyxFQUFFLEdBQUcsRUFBRSxHQUFHLENBQUMsRUFBRSxDQUFDLEdBQUcsRUFBRSxHQUFHLEVBQUUsRUFBRSxDQUFDLEVBQUUsQ0FBQyxHQUFHLEVBQUUsR0FBRyxFQUFFLEVBQUUsQ0FBQyxFQUFFLENBQUMsR0FBRyxFQUFFLEdBQUcsRUFBRSxFQUFFLENBQUMsRUFBRSxDQUFDLElBQUksRUFBRSxHQUFHLEVBQUUsRUFBRSxDQUFDLEVBQUUsQ0FBQyxJQUFJLEVBQUUsR0FBRyxFQUFFLEdBQUcsQ0FBQyxFQUFFLENBQUMsR0FBRyxFQUFFLEdBQUcsRUFBRSxFQUFFLENBQUMsRUFBRSxDQUFDLEdBQUcsRUFBRSxHQUFHLEVBQUUsRUFBRSxDQUFDLEVBQUUsQ0FBQyxHQUFHLEVBQUUsR0FBRyxFQUFFLEVBQUUsQ0FBQyxFQUFFLENBQUMsR0FBRyxFQUFFLEdBQUcsRUFBRSxFQUFFLENBQUMsQ0FBQztZQUM5SyxXQUFXLEVBQUUsQ0FBQyxDQUFDLEdBQUcsRUFBRSxHQUFHLEVBQUUsRUFBRSxDQUFDLEVBQUUsQ0FBQyxJQUFJLEVBQUUsR0FBRyxFQUFFLEVBQUUsQ0FBQyxDQUFDO1lBQzlDLFFBQVEsRUFBRSxDQUFDLENBQUMsR0FBRyxFQUFFLEdBQUcsRUFBRSxFQUFFLENBQUMsRUFBRSxDQUFDLEdBQUcsRUFBRSxHQUFHLEVBQUUsRUFBRSxDQUFDLEVBQUUsQ0FBQyxJQUFJLEVBQUUsR0FBRyxFQUFFLEVBQUUsQ0FBQyxFQUFFLENBQUMs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QUFFLEVBQUUsQ0FBQyxFQUFFLENBQUMsR0FBRyxFQUFFLEdBQUcsRUFBRSxFQUFFLENBQUMsRUFBRSxDQUFDLEdBQUcsRUFBRSxHQUFHLEVBQUUsRUFBRSxDQUFDLEVBQUUsQ0FBQyxJQUFJLEVBQUUsRUFBRSxFQUFFLEVBQUUsQ0FBQyxFQUFFLENBQUMsSUFBSSxFQUFFLEdBQUcsRUFBRSxFQUFFLENBQUMsRUFBRSxDQUFDLElBQUksRUFBRSxHQUFHLEVBQUUsRUFBRSxDQUFDLENBQUM7WUFDNUgsV0FBVyxFQUFFLENBQUMsQ0FBQyxHQUFHLEVBQUUsR0FBRyxFQUFFLEVBQUUsQ0FBQyxFQUFFLENBQUMsR0FBRyxFQUFFLEdBQUcsRUFBRSxFQUFFLENBQUMsQ0FBQztZQUM3QyxRQUFRLEVBQUUsQ0FBQyxDQUFDLEdBQUcsRUFBRSxHQUFHLEVBQUUsRUFBRSxDQUFDLEVBQUUsQ0FBQyxHQUFHLEVBQUUsR0FBRyxFQUFFLEVBQUUsQ0FBQyxFQUFFLENBQUMsR0FBRyxFQUFFLEdBQUcsRUFBRSxFQUFFLENBQUMsRUFBRSxDQUFDLEdBQUcsRUFBRSxHQUFHLEVBQUUsRUFBRSxDQUFDLEVBQUUsQ0FBQyxJQUFJLEVBQUUsR0FBRyxFQUFFLEVBQUUsQ0FBQyxFQUFFLENBQUMsSUFBSSxFQUFFLEdBQUcsRUFBRSxFQUFFLENBQUMsQ0FBQztZQUM1RyxPQUFPLEVBQUUsQ0FBQyxFQUFFLEVBQUUsR0FBRyxDQUFDO1lBQ2xCLFFBQVEsRUFBRSxDQUFDLElBQUksRUFBRSxHQUFHLENBQUM7WUFDckIsS0FBSyxFQUFFLENBQUMsR0FBRyxFQUFFLEdBQUcsQ0FBQztTQUNwQjtRQUNEO1lBQ0ksUUFBUSxFQUFFLENBQUMsQ0FBQyxHQUFHLEVBQUUsR0FBRyxFQUFFLEdBQUcsQ0FBQyxFQUFFLENBQUMsR0FBRyxFQUFFLEdBQUcsRUFBRSxFQUFFLENBQUMsRUFBRSxDQUFDLEdBQUcsRUFBRSxHQUFHLEVBQUUsRUFBRSxDQUFDLEVBQUUsQ0FBQyxHQUFHLEVBQUUsRUFBRSxFQUFFLEVBQUUsQ0FBQyxFQUFFLENBQUMsR0FBRyxFQUFFLEdBQUcsRUFBRSxFQUFFLENBQUMsRUFBRSxDQUFDLEdBQUcsRUFBRSxHQUFHLEVBQUUsRUFBRSxDQUFDLEVBQUUsQ0FBQyxHQUFHLEVBQUUsR0FBRyxFQUFFLEVBQUUsQ0FBQyxFQUFFLENBQUMsR0FBRyxFQUFFLEdBQUcsRUFBRSxFQUFFLENBQUMsRUFBRSxDQUFDLEdBQUcsRUFBRSxHQUFHLEVBQUUsRUFBRSxDQUFDLEVBQUUsQ0FBQyxHQUFHLEVBQUUsR0FBRyxFQUFFLEVBQUUsQ0FBQyxFQUFFLENBQUMsR0FBRyxFQUFFLEdBQUcsRUFBRSxFQUFFLENBQUMsQ0FBQztZQUMxTCxXQUFXLEVBQUUsQ0FBQyxDQUFDLEdBQUcsRUFBRSxHQUFHLEVBQUUsRUFBRSxDQUFDLEVBQUUsQ0FBQyxHQUFHLEVBQUUsR0FBRyxFQUFFLEVBQUUsQ0FBQyxDQUFDO1lBQzdDLFFBQVEsRUFBRSxDQUFDLENBQUMsSUFBSSxFQUFFLEdBQUcsRUFBRSxFQUFFLENBQUMsRUFBRSxDQUFDLEdBQUcsRUFBRSxHQUFHLEVBQUUsRUFBRSxDQUFDLEVBQUUsQ0FBQyxHQUFHLEVBQUUsR0FBRyxFQUFFLEVBQUUsQ0FBQyxFQUFFLENBQUMsR0FBRyxFQUFFLEdBQUcsRUFBRSxFQUFFLENBQUMsRUFBRSxDQUFDLEdBQUcsRUFBRSxHQUFHLEVBQUUsRUFBRSxDQUFDLEVBQUUsQ0FBQyxHQUFHLEVBQUUsR0FBRyxFQUFFLEVBQUUsQ0FBQyxFQUFFLENBQUMsR0FBRyxFQUFFLEdBQUcsRUFBRSxFQUFFLENBQUMsRUFBRSxDQUFDLEdBQUcsRUFBRSxHQUFHLEVBQUUsRUFBRSxDQUFDLENBQUM7WUFDM0ksT0FBTyxFQUFFLENBQUMsRUFBRSxFQUFFLEdBQUcsQ0FBQztZQUNsQixRQUFRLEVBQUUsQ0FBQyxJQUFJLEVBQUUsR0FBRyxDQUFDO1lBQ3JCLEtBQUssRUFBRSxDQUFDLEdBQUcsRUFBRSxHQUFHLENBQUM7U0FDcEI7UUFDRDtZQUNJLFFBQVEsRUFBRSxDQUFDLENBQUMsR0FBRyxFQUFFLEdBQUcsRUFBRSxFQUFFLENBQUMsRUFBRSxDQUFDLEdBQUcsRUFBRSxHQUFHLEVBQUUsRUFBRSxDQUFDLEVBQUUsQ0FBQyxHQUFHLEVBQUUsR0FBRyxFQUFFLEVBQUUsQ0FBQyxFQUFFLENBQUMsR0FBRyxFQUFFLEdBQUcsRUFBRSxFQUFFLENBQUMsRUFBRSxDQUFDLEdBQUcsRUFBRSxHQUFHLEVBQUUsRUFBRSxDQUFDLEVBQUUsQ0FBQyxJQUFJLEVBQUUsR0FBRyxFQUFFLEVBQUUsQ0FBQyxFQUFFLENBQUMsR0FBRyxFQUFFLEdBQUcsRUFBRSxFQUFFLENBQUMsRUFBRSxDQUFDLElBQUksRUFBRSxHQUFHLEVBQUUsRUFBRSxDQUFDLEVBQUUsQ0FBQyxJQUFJLEVBQUUsR0FBRyxFQUFFLEVBQUUsQ0FBQyxFQUFFLENBQUMsR0FBRyxFQUFFLEdBQUcsRUFBRSxFQUFFLENBQUMsQ0FBQztZQUM3SyxXQUFXLEVBQUUsRUFBRTtZQUNmLFFBQVEsRUFBRSxDQUFDLENBQUMsSUFBSSxFQUFFLEdBQUcsRUFBRSxFQUFFLENBQUMsRUFBRSxDQUFDLEdBQUcsRUFBRSxHQUFHLEVBQUUsRUFBRSxDQUFDLEVBQUUsQ0FBQyxHQUFHLEVBQUUsR0FBRyxFQUFFLEVBQUUsQ0FBQyxFQUFFLENBQUMsR0FBRyxFQUFFLEdBQUcsRUFBRSxFQUFFLENBQUMsRUFBRSxDQUFDLEdBQUcsRUFBRSxHQUFHLEVBQUUsRUFBRSxDQUFDLEVBQUUsQ0FBQyxJQUFJLEVBQUUsR0FBRyxFQUFFLEVBQUUsQ0FBQyxFQUFFLENBQUMsSUFBSSxFQUFFLEdBQUcsRUFBRSxFQUFFLENBQUMsQ0FBQztZQUM3SCxPQUFPLEVBQUUsQ0FBQyxFQUFFLEVBQUUsR0FBRyxDQUFDO1lBQ2xCLFFBQVEsRUFBRSxDQUFDLElBQUksRUFBRSxHQUFHLENBQUM7WUFDckIsS0FBSyxFQUFFLENBQUMsR0FBRyxFQUFFLEdBQUcsQ0FBQztTQUNwQjtLQUNKO0NBQ0osQ0FBQztBQ3hKRixJQUFNLHFCQUFxQixHQUFHLFVBQUMsWUFBMEI7SUFDckQsSUFBTSxFQUFFLEdBQVMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQztJQUNoQyxJQUFNLE1BQU0sR0FBYSxFQUFFLENBQUM7SUFDNUIsSUFBSSxVQUEyQixDQUFDO0lBQ2hDLElBQUksWUFBMEIsQ0FBQztJQUMvQixJQUFJLFVBQVUsR0FBRyxLQUFLLENBQUM7SUFDdkIsSUFBSSxNQUFNLEdBQUcsS0FBSyxDQUFDO0lBRW5CLGtDQUFrQztJQUNsQyxJQUFNLGlCQUFpQixHQUFHLFVBQUMsQ0FBYTtRQUN0QyxJQUFNLEtBQUssR0FBRyxDQUFDLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQyxDQUFDO1FBQzNCLFlBQVksQ0FBQyxRQUFRLENBQUMsQ0FBQyxHQUFHLEtBQUssQ0FBQyxPQUFPLENBQUM7UUFDeEMsWUFBWSxDQUFDLFFBQVEsQ0FBQyxDQUFDLEdBQUcsS0FBSyxDQUFDLE9BQU8sQ0FBQztRQUN4QyxDQUFDLENBQUMsY0FBYyxFQUFFLENBQUM7SUFDckIsQ0FBQyxDQUFDO0lBRUYsT0FBTztRQUNMLFNBQVMsRUFBRSxVQUFDLE1BQU07WUFDaEIsNENBQTRDO1lBQzVDLElBQUksTUFBTSxDQUFDLEtBQUssSUFBSSxDQUFDLE1BQU0sQ0FBQyxLQUFLLENBQUMsSUFBSSxLQUFLLFFBQVEsQ0FBQyxLQUFLLElBQUksTUFBTSxDQUFDLEtBQUssQ0FBQyxJQUFJLEtBQUssUUFBUSxDQUFDLFFBQVEsQ0FBQyxFQUFFO2dCQUNyRyxNQUFNLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxDQUFDO2FBQ3JCO1lBQ0QsSUFBSSxNQUFNLENBQUMsTUFBTSxFQUFFO2dCQUNqQixZQUFZLEdBQUcsTUFBTSxDQUFDO2FBQ3ZCO1lBRUQsSUFBSSxNQUFNLENBQUMsU0FBUyxFQUFFO2dCQUNwQixZQUFZLENBQUMsV0FBVyxDQUFDLE1BQU0sRUFBRTtvQkFDL0IsU0FBUyxFQUFFO3dCQUNULE1BQU0sR0FBRyxJQUFJLENBQUM7d0JBQ2QsSUFBSSxZQUFZLENBQUMsV0FBVyxFQUFFLEVBQUU7NEJBQzlCLE9BQU87eUJBQ1I7d0JBQ0QsUUFBUSxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsTUFBTSxHQUFHLFNBQVMsQ0FBQzt3QkFDdkMsVUFBVSxHQUFHLE1BQU0sQ0FBQzt3QkFDcEIsTUFBTSxDQUFDLE1BQU0sQ0FBQyxLQUFLLEdBQUcsSUFBSSxDQUFDO29CQUM3QixDQUFDO29CQUNELFFBQVEsRUFBRTt3QkFDUixRQUFRLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxNQUFNLEdBQUcsU0FBUyxDQUFDO3dCQUN2QyxNQUFNLEdBQUcsS0FBSyxDQUFDO3dCQUNmLElBQUksQ0FBQyxVQUFVLEVBQUU7NEJBQ2YsTUFBTSxDQUFDLE1BQU0sQ0FBQyxLQUFLLEdBQUcsS0FBSyxDQUFDO3lCQUM3QjtvQkFDSCxDQUFDO29CQUNELFNBQVMsRUFBRTt3QkFDVCxVQUFVLEdBQUcsSUFBSSxDQUFDO3dCQUNsQixTQUFTLENBQUMsRUFBRSxFQUFFLElBQUksQ0FBQyxZQUFZLENBQUMsUUFBUSxFQUFFLE1BQU0sQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDO29CQUN6RCxDQUFDO29CQUNELE9BQU8sRUFBRTt3QkFDUCxVQUFVLEdBQUcsS0FBSyxDQUFDO3dCQUNuQixJQUFJLENBQUMsTUFBTSxFQUFFOzRCQUNYLE1BQU0sQ0FBQyxNQUFNLENBQUMsS0FBSyxHQUFHLEtBQUssQ0FBQzt5QkFDN0I7b0JBQ0gsQ0FBQztvQkFDRCxlQUFlLEVBQUUsY0FBTyxDQUFDO2lCQUMxQixDQUFDLENBQUM7YUFDSjtRQUNILENBQUM7UUFDRCxNQUFNLEVBQUUsVUFBQyxJQUFZO1lBQ25CLFlBQVksQ0FBQyxNQUFNLEVBQUUsQ0FBQztZQUN0QixJQUFJLENBQUMsVUFBVSxFQUFFO2dCQUNmLE9BQU87YUFDUjtZQUVELFVBQVUsSUFBSSxTQUFTLENBQUMsVUFBVSxDQUFDLEdBQUcsRUFBRSxJQUFJLENBQUMsWUFBWSxDQUFDLFFBQVEsRUFBRSxFQUFFLENBQUMsQ0FBQyxDQUFDO1lBRXpFLElBQU0sRUFBRSxHQUFHLFVBQVUsQ0FBQyxHQUFHLENBQUM7WUFFMUIsNEJBQTRCO1lBQzVCLEVBQUUsQ0FBQyxDQUFDLEdBQUcsS0FBSyxDQUFDLEVBQUUsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxFQUFFLElBQUksQ0FBQyxDQUFDO1lBQzVCLEVBQUUsQ0FBQyxDQUFDLEdBQUcsS0FBSyxDQUFDLEVBQUUsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxFQUFFLEdBQUcsQ0FBQyxDQUFDO1lBRTNCLGlDQUFpQztZQUNqQyxNQUFNLENBQUMsT0FBTyxDQUFDLFVBQUMsS0FBSztnQkFDbkIsSUFBSSxLQUFLLEtBQUssVUFBVSxFQUFFO29CQUN4QixPQUFPO2lCQUNSO2dCQUNELElBQU0sRUFBRSxHQUFHLEtBQUssQ0FBQyxHQUFHLENBQUM7Z0JBQ3JCLElBQU0sSUFBSSxHQUFHLEVBQUUsR0FBRyxLQUFLLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQztnQkFDbkMsSUFBSSxLQUFLLENBQUMsRUFBRSxFQUFFLEVBQUUsQ0FBQyxHQUFHLElBQUksRUFBRTtvQkFDeEIsSUFBTSxHQUFHLEdBQUcsVUFBVSxDQUFDLElBQUksQ0FBQyxFQUFFLEVBQUUsRUFBRSxDQUFDLENBQUMsQ0FBQztvQkFDckMsSUFBSSxHQUFHLENBQUMsQ0FBQyxLQUFLLENBQUMsSUFBSSxHQUFHLENBQUMsQ0FBQyxLQUFLLENBQUMsRUFBRTt3QkFDOUIsR0FBRyxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUM7cUJBQ1g7b0JBQ0QsSUFBTSxDQUFDLEdBQUcsS0FBSyxDQUFDLEdBQUcsRUFBRSxJQUFJLENBQUMsQ0FBQztvQkFDM0IsVUFBVSxDQUFDLEdBQUcsR0FBRyxJQUFJLENBQUMsRUFBRSxFQUFFLENBQUMsQ0FBQyxDQUFDO2lCQUM5QjtZQUNILENBQUMsQ0FBQyxDQUFDO1lBRUgsaUJBQWlCO1lBQ2pCLElBQUksS0FBSyxDQUFDLEVBQUUsRUFBRSxZQUFZLENBQUMsR0FBRyxDQUFDLEdBQUcsRUFBRSxFQUFFO2dCQUNwQyxZQUFZLENBQUMsTUFBTSxDQUFDLFNBQVMsR0FBRyxJQUFJLENBQUM7Z0JBQ3JDLFNBQVMsQ0FBQyxVQUFVLENBQUMsR0FBRyxFQUFFLFlBQVksQ0FBQyxHQUFHLENBQUMsQ0FBQzthQUM3QztpQkFBTTtnQkFDTCxZQUFZLENBQUMsTUFBTSxDQUFDLFNBQVMsR0FBRyxLQUFLLENBQUM7YUFDdkM7UUFDSCxDQUFDO0tBQ0YsQ0FBQztBQUNKLENBQUMsQ0FBQztBQ2pHSixJQUFNLHVCQUF1QixHQUFHLFVBQUMsU0FBb0I7SUFDakQsSUFBTSxRQUFRLEdBQWEsRUFBRSxDQUFDO0lBQ3ZCLElBQUEsdUJBQUssRUFBRSx5QkFBTSxFQUFFLCtCQUFTLEVBQUUscUJBQUksRUFBRSx5QkFBTSxFQUFFLHVCQUFLLENBQWM7SUFFbEUsT0FBTztRQUNILFNBQVMsRUFBRSxVQUFDLE1BQWM7WUFDdEIsSUFBSSxNQUFNLENBQUMsTUFBTSxFQUFFO2dCQUNmLFFBQVEsQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLENBQUM7YUFDekI7UUFDTCxDQUFDO1FBQ0QsTUFBTSxFQUFFLFVBQUMsT0FBZ0IsRUFBRSxJQUFZO1lBQ25DLFFBQVEsQ0FBQyxPQUFPLENBQUMsVUFBQSxNQUFNO2dCQUNuQixRQUFRLE1BQU0sQ0FBQyxNQUFNLENBQUMsSUFBSSxFQUFFO29CQUN4QixLQUFLLFFBQVEsQ0FBQyxLQUFLO3dCQUNmLE9BQU8sQ0FBQyxTQUFTLENBQUMsS0FBSyxDQUFDLE1BQU0sQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLEVBQUUsTUFBTSxDQUFDLEdBQUcsQ0FBQyxDQUFDLEdBQUcsTUFBTSxDQUFDLEtBQUssQ0FBQyxJQUFJLEdBQUcsQ0FBQyxFQUFFLE1BQU0sQ0FBQyxHQUFHLENBQUMsQ0FBQyxHQUFHLE1BQU0sQ0FBQyxLQUFLLENBQUMsSUFBSSxHQUFHLENBQUMsQ0FBQyxDQUFDO3dCQUN4SCxPQUFPLENBQUMsU0FBUyxDQUFDLFNBQVMsQ0FBQyxHQUFHLEVBQUUsTUFBTSxDQUFDLEdBQUcsQ0FBQyxDQUFDLEdBQUcsRUFBRSxFQUFFLE1BQU0sQ0FBQyxHQUFHLENBQUMsQ0FBQyxHQUFHLEVBQUUsQ0FBQyxDQUFDO3dCQUN2RSxJQUFJLE1BQU0sQ0FBQyxLQUFLLENBQUMsV0FBVyxFQUFFOzRCQUMxQixPQUFPLENBQUMsU0FBUyxDQUFDLFNBQVMsQ0FBQyxPQUFPLEVBQUUsTUFBTSxDQUFDLEdBQUcsQ0FBQyxDQUFDLEdBQUcsRUFBRSxFQUFFLE1BQU0sQ0FBQyxHQUFHLENBQUMsQ0FBQyxHQUFHLEVBQUUsQ0FBQyxDQUFDO3lCQUM5RTs2QkFBTSxJQUFJLE1BQU0sQ0FBQyxLQUFLLENBQUMsT0FBTyxFQUFFOzRCQUM3QixPQUFPLENBQUMsU0FBUyxDQUFDLFNBQVMsQ0FBQyxTQUFTLEVBQUUsTUFBTSxDQUFDLEdBQUcsQ0FBQyxDQUFDLEdBQUcsRUFBRSxFQUFFLE1BQU0sQ0FBQyxHQUFHLENBQUMsQ0FBQyxHQUFHLEVBQUUsQ0FBQyxDQUFDO3lCQUNoRjt3QkFDRCxNQUFNO29CQUNWLEtBQUssUUFBUSxDQUFDLFFBQVE7d0JBQ2xCLE9BQU8sQ0FBQyxTQUFTLENBQUMsU0FBUyxDQUFDLE1BQU0sQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLEVBQUUsTUFBTSxDQUFDLEdBQUcsQ0FBQyxDQUFDLEdBQUcsTUFBTSxDQUFDLEtBQUssQ0FBQyxJQUFJLEdBQUcsQ0FBQyxFQUFFLE1BQU0sQ0FBQyxHQUFHLENBQUMsQ0FBQyxHQUFHLE1BQU0sQ0FBQyxLQUFLLENBQUMsSUFBSSxHQUFHLENBQUMsQ0FBQyxDQUFDO3dCQUM1SCxNQUFNO29CQUNWLEtBQUssUUFBUSxDQUFDLEtBQUs7d0JBQ2YsT0FBTyxDQUFDLElBQUksRUFBRSxDQUFDO3dCQUNmLE9BQU8sQ0FBQyxTQUFTLENBQUMsTUFBTSxDQUFDLEdBQUcsQ0FBQyxDQUFDLEVBQUUsTUFBTSxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQzt3QkFDOUMsT0FBTyxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsQ0FBQzt3QkFDckIsSUFBTSxNQUFNLEdBQUcsTUFBTSxDQUFDLE1BQU0sQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLENBQUM7d0JBQ3pDLE9BQU8sQ0FBQyxTQUFTLENBQUMsTUFBTSxFQUFFLENBQUMsTUFBTSxDQUFDLEtBQUssR0FBRyxDQUFDLEVBQUUsQ0FBQyxNQUFNLENBQUMsTUFBTSxHQUFHLENBQUMsQ0FBQyxDQUFDO3dCQUNqRSxPQUFPLENBQUMsT0FBTyxFQUFFLENBQUM7d0JBQ2xCLE1BQU07b0JBQ1YsS0FBSyxRQUFRLENBQUMsTUFBTTt3QkFDaEIsT0FBTyxDQUFDLFNBQVMsQ0FBQyxNQUFNLEVBQUUsTUFBTSxDQUFDLEdBQUcsQ0FBQyxDQUFDLEdBQUcsRUFBRSxFQUFFLE1BQU0sQ0FBQyxHQUFHLENBQUMsQ0FBQyxHQUFHLEVBQUUsQ0FBQyxDQUFDO3dCQUNoRSxNQUFNO29CQUNWLEtBQUssUUFBUSxDQUFDLEtBQUs7d0JBQ2YsT0FBTyxDQUFDLFNBQVMsQ0FBQyxLQUFLLEVBQUUsTUFBTSxDQUFDLEdBQUcsQ0FBQyxDQUFDLEdBQUcsRUFBRSxFQUFFLE1BQU0sQ0FBQyxHQUFHLENBQUMsQ0FBQyxHQUFHLEVBQUUsQ0FBQyxDQUFDO3dCQUMvRCxNQUFNO29CQUNWLEtBQUssUUFBUSxDQUFDLEdBQUc7d0JBQ2IsT0FBTyxDQUFDLFNBQVMsQ0FBQyxJQUFJLEVBQUUsTUFBTSxDQUFDLEdBQUcsQ0FBQyxDQUFDLEdBQUcsRUFBRSxFQUFFLE1BQU0sQ0FBQyxHQUFHLENBQUMsQ0FBQyxHQUFHLEVBQUUsQ0FBQyxDQUFDO3dCQUM5RCxJQUFJLE1BQU0sQ0FBQyxNQUFNLENBQUMsS0FBSyxFQUFFOzRCQUNyQixPQUFPLENBQUMsV0FBVyxHQUFHLEdBQUcsR0FBRyxDQUFDLEdBQUcsR0FBRyxJQUFJLENBQUMsR0FBRyxDQUFDLElBQUksR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDOzRCQUN2RCxPQUFPLENBQUMsU0FBUyxDQUFDLFNBQVMsQ0FBQyxRQUFRLEVBQUUsTUFBTSxDQUFDLEdBQUcsQ0FBQyxDQUFDLEdBQUcsRUFBRSxFQUFFLE1BQU0sQ0FBQyxHQUFHLENBQUMsQ0FBQyxHQUFHLEVBQUUsQ0FBQyxDQUFDO3lCQUMvRTs2QkFBTTs0QkFDSCxPQUFPLENBQUMsV0FBVyxHQUFHLEdBQUcsR0FBRyxDQUFDLEdBQUcsR0FBRyxJQUFJLENBQUMsR0FBRyxDQUFDLElBQUksR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDOzRCQUN2RCxPQUFPLENBQUMsU0FBUyxDQUFDLFNBQVMsQ0FBQyxRQUFRLEVBQUUsTUFBTSxDQUFDLEdBQUcsQ0FBQyxDQUFDLEdBQUcsRUFBRSxFQUFFLE1BQU0sQ0FBQyxHQUFHLENBQUMsQ0FBQyxHQUFHLEVBQUUsQ0FBQyxDQUFDO3lCQUMvRTt3QkFDRCxPQUFPLENBQUMsV0FBVyxHQUFHLENBQUMsQ0FBQzt3QkFDeEIsTUFBTTtpQkFFYjtZQUNMLENBQUMsQ0FBQyxDQUFDO1FBQ1AsQ0FBQztLQUNKLENBQUM7QUFDTixDQUFDLENBQUM7QUFFRixJQUFNLHVCQUF1QixHQUFHO0lBQzVCLElBQU0sUUFBUSxHQUFhLEVBQUUsQ0FBQztJQUM5QixPQUFPO1FBQ0gsU0FBUyxFQUFFLFVBQUMsTUFBYztZQUN0QixJQUFJLE1BQU0sQ0FBQyxLQUFLLEVBQUU7Z0JBQ2QsUUFBUSxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsQ0FBQzthQUN6QjtRQUNMLENBQUM7UUFDRCxNQUFNLEVBQUUsVUFBQyxPQUFnQjtZQUVyQixRQUFRLENBQUMsT0FBTyxDQUFDLFVBQUEsTUFBTTtnQkFDbkIsSUFBTSxXQUFXLEdBQUcsTUFBTSxDQUFDLEtBQUssQ0FBQyxXQUFXLENBQUM7Z0JBQzdDLEtBQUssSUFBSSxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsR0FBRyxXQUFXLENBQUMsTUFBTSxHQUFHLENBQUMsRUFBRSxDQUFDLEVBQUUsRUFBRTtvQkFDN0MsSUFBTSxDQUFDLEdBQUcsV0FBVyxDQUFDLENBQUMsQ0FBQyxDQUFDO29CQUN6QixJQUFNLENBQUMsR0FBRyxXQUFXLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDO29CQUU3QixPQUFPLENBQUMsSUFBSSxFQUFFLENBQUM7b0JBRWYsSUFBSSxDQUFDLENBQUMsT0FBTyxFQUFFO3dCQUNYLE9BQU8sQ0FBQyxXQUFXLENBQUMsQ0FBQyxDQUFDLEVBQUUsRUFBRSxDQUFDLENBQUMsQ0FBQztxQkFDaEM7b0JBQ0QsSUFBSSxDQUFDLENBQUMsUUFBUSxFQUFFO3dCQUNaLE9BQU8sQ0FBQyxXQUFXLEdBQUcsU0FBUyxDQUFDO3dCQUNoQyxPQUFPLENBQUMsU0FBUyxHQUFHLENBQUMsQ0FBQztxQkFDekI7eUJBQU07d0JBQ0gsT0FBTyxDQUFDLFdBQVcsR0FBRyxPQUFPLENBQUM7d0JBQzlCLE9BQU8sQ0FBQyxTQUFTLEdBQUcsQ0FBQyxDQUFDO3FCQUN6QjtvQkFFRCxPQUFPLENBQUMsT0FBTyxHQUFHLE9BQU8sQ0FBQztvQkFDMUIsT0FBTyxDQUFDLFNBQVMsRUFBRSxDQUFDO29CQUNwQixPQUFPLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxNQUFPLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxNQUFPLENBQUMsQ0FBQyxDQUFDLENBQUM7b0JBQ3pDLE9BQU8sQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLEtBQU0sQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLEtBQU0sQ0FBQyxDQUFDLENBQUMsQ0FBQztvQkFDdkMsT0FBTyxDQUFDLE1BQU0sRUFBRSxDQUFDO29CQUVqQixPQUFPLENBQUMsT0FBTyxFQUFFLENBQUM7aUJBQ3JCO1lBQ0wsQ0FBQyxDQUFDLENBQUM7UUFDUCxDQUFDO0tBQ0osQ0FBQztBQUNOLENBQUMsQ0FBQztBQ2pGRixJQUFNLGlCQUFpQixHQUFHLFVBQUMsVUFBcUMsRUFBRSxNQUFzQztJQUNwRyxJQUFNLFFBQVEsR0FBbUIsRUFBRSxDQUFDO0lBQ3BDLElBQU0sV0FBVyxHQUFjLEVBQUUsQ0FBQztJQUNsQyxJQUFNLFlBQVksR0FBYyxFQUFFLENBQUM7SUFDbkMsSUFBTSxlQUFlLEdBQWMsRUFBRSxDQUFDO0lBQ3RDLENBQUMsRUFBRSxFQUFFLEVBQUUsRUFBRSxFQUFFLEVBQUUsRUFBRSxFQUFFLEVBQUUsRUFBRSxFQUFFLEVBQUUsRUFBRSxFQUFFLEdBQUcsRUFBRSxHQUFHLEVBQUUsR0FBRyxFQUFFLEdBQUcsRUFBRSxHQUFHLEVBQUUsR0FBRyxFQUFFLEdBQUcsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxVQUFBLElBQUk7UUFDeEUsUUFBUSxDQUFDLElBQUksQ0FBQztZQUNWLFdBQVcsQ0FBQyxJQUFJLENBQUMsR0FBRyxnQkFBZ0IsQ0FBQyxJQUFJLEdBQUcsQ0FBQyxHQUFHLEVBQUUsQ0FBQyxDQUFDO1FBQ3hELENBQUMsQ0FBQyxDQUFDO0lBQ1AsQ0FBQyxDQUFDLENBQUM7SUFDSCxDQUFDLEVBQUUsRUFBRSxFQUFFLEVBQUUsRUFBRSxFQUFFLEVBQUUsRUFBRSxFQUFFLEVBQUUsRUFBRSxFQUFFLEVBQUUsRUFBRSxHQUFHLEVBQUUsR0FBRyxFQUFFLEdBQUcsRUFBRSxHQUFHLEVBQUUsR0FBRyxFQUFFLEdBQUcsRUFBRSxHQUFHLENBQUMsQ0FBQyxPQUFPLENBQUMsVUFBQSxJQUFJO1FBQ3hFLFFBQVEsQ0FBQyxJQUFJLENBQUM7WUFDVixZQUFZLENBQUMsSUFBSSxDQUFDLEdBQUcsaUJBQWlCLENBQUMsSUFBSSxHQUFHLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQztRQUN6RCxDQUFDLENBQUMsQ0FBQztJQUNQLENBQUMsQ0FBQyxDQUFDO0lBQ0gsQ0FBQyxFQUFFLEVBQUUsRUFBRSxFQUFFLEVBQUUsRUFBRSxFQUFFLEVBQUUsRUFBRSxFQUFFLEVBQUUsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxVQUFBLElBQUk7UUFDakMsUUFBUSxDQUFDLElBQUksQ0FBQztZQUNWLGVBQWUsQ0FBQyxJQUFJLENBQUMsR0FBRyxvQkFBb0IsQ0FBQyxJQUFJLEdBQUcsQ0FBQyxHQUFHLEVBQUUsQ0FBQyxDQUFDO1FBQ2hFLENBQUMsQ0FBQyxDQUFDO0lBQ1AsQ0FBQyxDQUFDLENBQUM7SUFFSCxJQUFNLEdBQUcsR0FBRyxlQUFlLEVBQUUsQ0FBQztJQUM5QixJQUFNLFNBQVMsR0FBRyxVQUFVLENBQUMsTUFBTSxDQUFDLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQztJQUM5QyxJQUFNLE9BQU8sR0FBRyxVQUFVLENBQUMsTUFBTSxDQUFDLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQztJQUM1QyxJQUFNLFNBQVMsR0FBRyxzQkFBc0IsQ0FBQyxNQUFNLENBQUMsR0FBRyxFQUFFLEdBQUcsRUFBRSxHQUFHLENBQUMsRUFBQyxFQUFFLENBQUMsQ0FBQztJQUNuRSxJQUFNLEtBQUssR0FBRyxzQkFBc0IsQ0FBQyxNQUFNLENBQUMsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLENBQUMsRUFBQyxFQUFFLENBQUMsQ0FBQztJQUN6RCxJQUFNLFFBQVEsR0FBRyxjQUFjLENBQUMsTUFBTSxDQUFDLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQztJQUNqRCxJQUFNLE1BQU0sR0FBRyxzQkFBc0IsQ0FBQyxNQUFNLENBQUMsQ0FBQyxFQUFFLEdBQUcsRUFBRSxHQUFHLENBQUMsRUFBQyxFQUFFLENBQUMsQ0FBQztJQUU5RCxrQkFBa0I7SUFDWixJQUFBLDJCQUE2QyxFQUE1QyxpQkFBUyxFQUFFLGVBQU8sQ0FBMkI7SUFDcEQsU0FBUyxDQUFDLFNBQVMsR0FBRyxVQUFVLENBQUM7SUFDakMsT0FBTyxDQUFDLElBQUksR0FBRyxpQkFBaUIsQ0FBQztJQUNqQyxPQUFPLENBQUMsU0FBUyxHQUFHLE1BQU0sQ0FBQztJQUMzQixPQUFPLENBQUMsUUFBUSxDQUFDLHVCQUF1QixFQUFFLEVBQUUsRUFBRSxFQUFFLENBQUMsQ0FBQztJQUNsRCxPQUFPLENBQUMsU0FBUyxDQUFDLFNBQVMsRUFBRSxHQUFHLEVBQUUsRUFBRSxDQUFDLENBQUM7SUFDdEMsT0FBTyxDQUFDLFFBQVEsQ0FBQyxpQ0FBaUMsRUFBRSxFQUFFLEVBQUUsR0FBRyxDQUFDLENBQUM7SUFDN0QsT0FBTyxDQUFDLFNBQVMsQ0FBQyxnQkFBZ0IsQ0FBQyxFQUFFLENBQUMsRUFBRSxHQUFHLEVBQUUsRUFBRSxDQUFDLENBQUM7SUFDakQsT0FBTyxDQUFDLFFBQVEsQ0FBQyxvQ0FBb0MsRUFBRSxFQUFFLEVBQUUsR0FBRyxDQUFDLENBQUM7SUFDaEUsT0FBTyxDQUFDLFNBQVMsQ0FBQyxNQUFNLEVBQUUsR0FBRyxFQUFFLEdBQUcsQ0FBQyxDQUFDO0lBRTlCLElBQUEsMkJBQTZDLEVBQTVDLGlCQUFTLEVBQUUsZUFBTyxDQUEyQjtJQUNwRCxTQUFTLENBQUMsU0FBUyxHQUFHLFVBQVUsQ0FBQztJQUNqQyxPQUFPLENBQUMsSUFBSSxHQUFHLGlCQUFpQixDQUFDO0lBQ2pDLE9BQU8sQ0FBQyxTQUFTLEdBQUcsTUFBTSxDQUFDO0lBQzNCLE9BQU8sQ0FBQyxRQUFRLENBQUMscUNBQXFDLEVBQUUsRUFBRSxFQUFFLEVBQUUsQ0FBQyxDQUFDO0lBQ2hFLE9BQU8sQ0FBQyxTQUFTLENBQUMsb0JBQW9CLENBQUMsRUFBRSxDQUFDLEVBQUUsR0FBRyxFQUFFLEVBQUUsQ0FBQyxDQUFDO0lBR3JELElBQU0sWUFBWSxHQUFHLFFBQVEsQ0FBQyxNQUFNLENBQUM7SUFDckMsSUFBSSxZQUFZLEdBQUcsQ0FBQyxDQUFDO0lBQ3JCLENBQUMsU0FBUyxPQUFPO1FBQ2IsSUFBTSxRQUFRLEdBQUcsUUFBUSxDQUFDLEtBQUssRUFBRSxDQUFDO1FBQ2xDLElBQUksUUFBUSxFQUFFO1lBQ1YsUUFBUSxFQUFFLENBQUM7WUFDWCxVQUFVLENBQUMsR0FBRyxHQUFHLFlBQVksR0FBRyxFQUFFLFlBQVksQ0FBQyxDQUFDO1lBQ2hELHFCQUFxQixDQUFDLE9BQU8sQ0FBQyxDQUFDO1NBQ2xDO2FBQU07WUFDSCxNQUFNLENBQUM7Z0JBQ0gsS0FBSyxFQUFFLFdBQVc7Z0JBQ2xCLE1BQU0sRUFBRSxZQUFZO2dCQUNwQixTQUFTLEVBQUUsZUFBZTtnQkFDMUIsU0FBUyxXQUFBO2dCQUNULE9BQU8sU0FBQTtnQkFDUCxHQUFHLEtBQUE7Z0JBQ0gsSUFBSSxFQUFFLFNBQVM7Z0JBQ2YsUUFBUSxVQUFBO2dCQUNSLE1BQU0sUUFBQTtnQkFDTixTQUFTLFdBQUE7Z0JBQ1QsU0FBUyxXQUFBO2dCQUNULEtBQUssT0FBQTthQUNSLENBQUMsQ0FBQztTQUNOO0lBQ0wsQ0FBQyxDQUFDLEVBQUUsQ0FBQztBQUVULENBQUMsQ0FBQztBQzFFRixJQUFNLFdBQVcsR0FBRztJQUNoQixJQUFNLE9BQU8sR0FBYSxFQUFFLENBQUM7SUFDN0IsSUFBTSxRQUFRLEdBQXNCLEVBQUUsQ0FBQztJQUV2QyxPQUFPO1FBQ0gsY0FBYyxFQUFFLFVBQUMsTUFBYztZQUMzQixPQUFPLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxDQUFDO1FBQ3pCLENBQUM7UUFDRCxTQUFTLEVBQUUsVUFBQyxNQUF1QjtZQUMvQixRQUFRLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxDQUFDO1lBQ3RCLE9BQU8sQ0FBQyxPQUFPLENBQUMsVUFBQSxNQUFNO2dCQUNsQixNQUFNLENBQUMsU0FBUyxDQUFDLE1BQWdCLENBQUMsQ0FBQztZQUN2QyxDQUFDLENBQUMsQ0FBQztRQUNQLENBQUM7UUFDRCxRQUFRLEVBQUM7WUFDTCxPQUFPLENBQUMsT0FBTyxDQUFDLFVBQUEsTUFBTSxJQUFJLE9BQUEsTUFBTSxDQUFDLFFBQVEsSUFBSSxNQUFNLENBQUMsUUFBUSxFQUFFLEVBQXBDLENBQW9DLENBQUMsQ0FBQztRQUNwRSxDQUFDO1FBQ0QsUUFBUSxVQUFBO0tBQ1gsQ0FBQztBQUNOLENBQUMsQ0FBQztBQ3JDRixJQUFNLGlCQUFpQixHQUFHLFVBQVUsV0FBeUI7SUFDekQsS0FBSyxJQUFJLENBQUMsR0FBRyxDQUFDLEVBQUUsQ0FBQyxHQUFHLFdBQVcsQ0FBQyxNQUFNLEdBQUcsQ0FBQyxFQUFFLENBQUMsRUFBRSxFQUFFO1FBQzdDLElBQU0sQ0FBQyxHQUFHLFdBQVcsQ0FBQyxDQUFDLENBQUMsQ0FBQztRQUN6QixJQUFNLENBQUMsR0FBRyxXQUFXLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDO1FBQzdCLElBQU0sUUFBUSxHQUFHLFdBQVcsQ0FBQyxDQUFDLENBQUMsTUFBTSxDQUFDLEdBQUcsRUFBRSxDQUFDLENBQUMsTUFBTSxDQUFDLEtBQUssQ0FBQyxJQUFJLEVBQUUsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxHQUFHLEVBQUUsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLENBQUM7UUFDbkcsSUFBTSxHQUFHLEdBQUcsQ0FBQyxDQUFDLElBQUksSUFBSSxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxJQUFJLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxJQUFJLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDO1FBRTVGLElBQUksQ0FBQyxRQUFRLENBQUMsR0FBRyxDQUFDLEVBQUU7U0FFbkI7UUFDRCxDQUFDLENBQUMsTUFBTSxHQUFHLFFBQVEsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztRQUM1QixDQUFDLENBQUMsS0FBSyxHQUFHLFFBQVEsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztLQUM5QjtBQUNMLENBQUMsQ0FBQztBQUVGLElBQU0sZ0JBQWdCLEdBQUcsVUFBQyxDQUFPLEVBQUUsQ0FBTyxFQUFFLGFBQTRCLEVBQUUsT0FBb0IsRUFBRSxPQUFvQjtJQUNoSCxPQUFPLGFBQWE7U0FDZixNQUFNLENBQUMsVUFBQSxXQUFXO1FBQ2YsT0FBQSxDQUFDLFdBQVcsSUFBSSxPQUFPLElBQUksV0FBVyxJQUFJLE9BQU8sQ0FBQztZQUNsRCxtQkFBbUIsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxFQUFFLFdBQVcsQ0FBQyxHQUFHLEVBQUUsV0FBVyxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUM7SUFEbEUsQ0FDa0UsQ0FDckU7U0FDQSxJQUFJLENBQUMsVUFBQyxFQUFFLEVBQUUsRUFBRSxJQUFLLE9BQUEsS0FBSyxDQUFDLEVBQUUsQ0FBQyxHQUFHLEVBQUUsQ0FBQyxDQUFDLEdBQUcsS0FBSyxDQUFDLEVBQUUsQ0FBQyxHQUFHLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQTVDLENBQTRDLENBQUMsQ0FBQyxDQUFDLDhCQUE4QjtBQUN2RyxDQUFDLENBQUM7QUFFRixJQUFNLGtCQUFrQixHQUFHLFVBQVUsV0FBeUIsRUFBRSxNQUFxQjtJQUNqRixJQUFJLFFBQWlCLENBQUM7SUFDdEIsR0FBRztRQUNDLFFBQVEsR0FBRyxJQUFJLENBQUM7UUFDaEIsS0FBSyxJQUFJLENBQUMsR0FBRyxDQUFDLEVBQUUsQ0FBQyxHQUFHLFdBQVcsQ0FBQyxNQUFNLEdBQUcsQ0FBQyxFQUFFLENBQUMsRUFBRSxFQUFFO1lBQzdDLElBQU0sQ0FBQyxHQUFHLFdBQVcsQ0FBQyxDQUFDLENBQUMsQ0FBQztZQUN6QixJQUFNLENBQUMsR0FBRyxXQUFXLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDO1lBQzdCLElBQU0sTUFBTSxHQUFHLGdCQUFnQixDQUFDLENBQUMsQ0FBQyxNQUFPLEVBQUUsQ0FBQyxDQUFDLEtBQU0sRUFBRSxNQUFNLEVBQUUsQ0FBQyxDQUFDLE1BQU0sRUFBRSxDQUFDLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7WUFDcEYsSUFBSSxNQUFNLEVBQUc7Z0JBQ1QsSUFBSSxNQUFNLENBQUMsS0FBSyxDQUFDLFVBQVUsRUFBRTtvQkFDekIseUJBQXlCO29CQUN6QixDQUFDLENBQUMsT0FBTyxHQUFHLElBQUksQ0FBQztpQkFDcEI7cUJBQU07b0JBQ0gsdUJBQXVCO29CQUN2QixNQUFNLENBQUMsS0FBSyxDQUFDLFVBQVUsR0FBRyxJQUFJLENBQUM7b0JBQy9CLElBQU0sSUFBSSxHQUFHLFVBQVUsQ0FBQyxDQUFDLENBQUMsTUFBTyxFQUFFLENBQUMsQ0FBQyxLQUFNLEVBQUUsTUFBTSxDQUFDLEdBQUcsQ0FBQyxDQUFDO29CQUN6RCxJQUFNLFVBQVUsR0FBZSxFQUFDLE1BQU0sRUFBRSxNQUFNLEVBQUUsSUFBSSxNQUFBLEVBQUMsQ0FBQztvQkFDdEQsV0FBVyxDQUFDLE1BQU0sQ0FBQyxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsRUFBRSxVQUFVLENBQUMsQ0FBQztvQkFDekMsUUFBUSxHQUFHLEtBQUssQ0FBQztvQkFDakIsaUJBQWlCLENBQUMsQ0FBQyxDQUFDLEVBQUUsVUFBVSxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUM7b0JBQ3RDLE1BQU07aUJBQ1Q7YUFDSjtTQUNKO0tBQ0osUUFBUSxDQUFDLFFBQVEsRUFBRTtBQUN4QixDQUFDLENBQUM7QUFFRixJQUFNLHFCQUFxQixHQUFHLFVBQVUsV0FBeUI7SUFDN0QsSUFBSSxRQUFpQixDQUFDO0lBQ3RCLEdBQUc7UUFDQyxRQUFRLEdBQUcsSUFBSSxDQUFDO1FBQ2hCLEtBQUssSUFBSSxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsR0FBRyxXQUFXLENBQUMsTUFBTSxHQUFHLENBQUMsRUFBRSxDQUFDLEVBQUUsRUFBRTtZQUM3QyxJQUFNLENBQUMsR0FBRyxXQUFXLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDO1lBQzdCLElBQU0sQ0FBQyxHQUFHLFdBQVcsQ0FBQyxDQUFDLENBQUMsQ0FBQztZQUN6QixJQUFNLENBQUMsR0FBRyxXQUFXLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDO1lBRTdCLElBQU0sR0FBRyxHQUFHLElBQUksQ0FBQyxDQUFDLENBQUMsTUFBTyxFQUFFLENBQUMsQ0FBQyxLQUFNLENBQUMsQ0FBQztZQUN0QyxJQUFNLEdBQUcsR0FBRyxJQUFJLENBQUMsQ0FBQyxDQUFDLE1BQU8sRUFBRSxDQUFDLENBQUMsS0FBTSxDQUFDLENBQUM7WUFDdEMsSUFBSSxLQUFLLEdBQUcsSUFBSSxDQUFDLEtBQUssQ0FBQyxHQUFHLENBQUMsQ0FBQyxFQUFFLEdBQUcsQ0FBQyxDQUFDLENBQUMsR0FBRyxJQUFJLENBQUMsS0FBSyxDQUFDLEdBQUcsQ0FBQyxDQUFDLEVBQUUsR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDO1lBQ2hFLElBQUksS0FBSyxHQUFHLENBQUM7Z0JBQUUsS0FBSyxJQUFJLENBQUMsR0FBRyxJQUFJLENBQUMsRUFBRSxDQUFDO1lBQ3BDLElBQUksQ0FBQyxDQUFDLENBQUMsSUFBSSxJQUFJLElBQUksQ0FBQyxJQUFJLElBQUksS0FBSyxHQUFHLElBQUksQ0FBQyxFQUFFLEdBQUcsR0FBRyxDQUFDO2dCQUM5QyxDQUFDLENBQUMsQ0FBQyxJQUFJLElBQUksSUFBSSxDQUFDLEtBQUssSUFBSSxLQUFLLEdBQUcsSUFBSSxDQUFDLEVBQUUsR0FBRyxHQUFHLENBQUMsRUFBRTtnQkFDakQsV0FBVyxDQUFDLE1BQU0sQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUM7Z0JBQ3pCLENBQUMsQ0FBQyxNQUFNLENBQUMsS0FBSyxDQUFDLFVBQVUsR0FBRyxLQUFLLENBQUM7Z0JBQ2xDLFFBQVEsR0FBRyxLQUFLLENBQUM7Z0JBQ2pCLGlCQUFpQixDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUM7Z0JBQzFCLE1BQU07YUFDVDtTQUNKO0tBQ0osUUFBUSxDQUFDLFFBQVEsRUFBRTtBQUN4QixDQUFDLENBQUM7QUFFRixJQUFNLGlCQUFpQixHQUFHLFVBQUMsZ0JBQTRCO0lBQ25ELElBQU0sYUFBYSxHQUFrQixFQUFFLENBQUM7SUFDeEMsSUFBTSxhQUFhLEdBQWtCLEVBQUUsQ0FBQztJQUN4QyxJQUFNLE1BQU0sR0FBa0IsRUFBRSxDQUFDO0lBQ2pDLElBQUksWUFBMEIsQ0FBQztJQUMvQixJQUFJLGlCQUFpQixHQUFFLENBQUMsQ0FBQztJQUN6QixJQUFJLFNBQVMsR0FBRyxDQUFDLENBQUM7SUFFbEIsT0FBTztRQUNILFNBQVMsRUFBRSxVQUFDLE1BQWM7WUFDdEIsSUFBSSxNQUFNLENBQUMsS0FBSyxFQUFFO2dCQUNkLGFBQWEsQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLENBQUM7Z0JBQzNCLElBQUksTUFBTSxDQUFDLEtBQUssQ0FBQyxJQUFJLElBQUksUUFBUSxDQUFDLEtBQUssRUFBRTtvQkFDckMsU0FBUyxFQUFFLENBQUM7b0JBQ1osUUFBUSxDQUFDLFNBQVMsR0FBRyxDQUFDLEdBQUcsS0FBSyxHQUFHLFNBQVMsQ0FBQztpQkFDOUM7YUFDSjtZQUNELElBQUksTUFBTSxDQUFDLEtBQUssRUFBRTtnQkFDZCxNQUFNLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxDQUFDO2FBQ3ZCO1lBQ0QsSUFBSSxNQUFNLENBQUMsS0FBSyxFQUFFO2dCQUNkLGFBQWEsQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLENBQUM7YUFDOUI7WUFDRCxJQUFJLE1BQU0sQ0FBQyxNQUFNLEVBQUU7Z0JBQ2YsWUFBWSxHQUFHLE1BQU0sQ0FBQzthQUN6QjtRQUNMLENBQUM7UUFDRCxNQUFNLEVBQUUsVUFBQyxJQUFZO1lBQ2pCLE1BQU0sQ0FBQyxPQUFPLENBQUMsVUFBQSxLQUFLO2dCQUNoQixJQUFNLFdBQVcsR0FBRyxLQUFLLENBQUMsS0FBSyxDQUFDLFdBQVcsQ0FBQztnQkFFNUMsZUFBZTtnQkFDZixLQUFLLENBQUMsS0FBSyxDQUFDLFdBQVcsR0FBRyxLQUFLLENBQUM7Z0JBQ2hDLFdBQVcsQ0FBQyxPQUFPLENBQUMsVUFBQSxVQUFVO29CQUMxQixVQUFVLENBQUMsT0FBTyxHQUFHLEtBQUssQ0FBQztnQkFDL0IsQ0FBQyxDQUFDLENBQUM7Z0JBQ0gsYUFBYSxDQUFDLE9BQU8sQ0FBQyxVQUFBLEtBQUs7b0JBQ3ZCLEtBQUssQ0FBQyxLQUFLLENBQUMsT0FBTyxHQUFHLEtBQUssQ0FBQyxLQUFLLENBQUMsV0FBVyxHQUFHLEtBQUssQ0FBQztnQkFDMUQsQ0FBQyxDQUFDLENBQUM7Z0JBQ0gsSUFBSSxnQkFBZ0IsR0FBRyxDQUFDLENBQUM7Z0JBR3pCLGlCQUFpQixDQUFDLFdBQVcsQ0FBQyxDQUFDO2dCQUMvQixrQkFBa0IsQ0FBQyxXQUFXLEVBQUUsYUFBYSxDQUFDLENBQUM7Z0JBQy9DLHFCQUFxQixDQUFDLFdBQVcsQ0FBQyxDQUFDO2dCQUVuQyxzQkFBc0I7Z0JBQ3RCLElBQUksVUFBVSxHQUFHLEtBQUssQ0FBQztnQkFDdkIsS0FBSyxDQUFDLEtBQUssQ0FBQyxXQUFXLENBQUMsT0FBTyxDQUFDLFVBQUEsVUFBVTtvQkFDdEMsSUFBTSxLQUFLLEdBQUcsVUFBVSxDQUFDLE1BQU0sQ0FBQyxLQUFLLENBQUM7b0JBQ3RDLElBQUksS0FBSyxDQUFDLElBQUksSUFBSSxRQUFRLENBQUMsUUFBUSxFQUFFO3dCQUNqQyxVQUFVLEdBQUcsQ0FBQyxVQUFVLENBQUM7cUJBQzVCO29CQUNELFVBQVUsQ0FBQyxRQUFRLEdBQUcsVUFBVSxDQUFDO2dCQUNyQyxDQUFDLENBQUMsQ0FBQztnQkFFSCxxQkFBcUI7Z0JBQ3JCLEtBQUssSUFBSSxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsR0FBRyxXQUFXLENBQUMsTUFBTSxHQUFHLENBQUMsRUFBRSxDQUFDLEVBQUUsRUFBRTtvQkFDN0MsSUFBTSxFQUFFLEdBQUcsV0FBVyxDQUFDLENBQUMsQ0FBQyxDQUFDO29CQUMxQixJQUFNLEVBQUUsR0FBRyxXQUFXLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDO29CQUM5QixJQUFJLEVBQUUsQ0FBQyxRQUFRLEVBQUU7d0JBQ2IsU0FBUztxQkFDWjtvQkFDRCxLQUFLLElBQUksQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDLEdBQUcsV0FBVyxDQUFDLE1BQU0sR0FBRyxDQUFDLEVBQUUsQ0FBQyxFQUFFLEVBQUU7d0JBQzdDLElBQU0sRUFBRSxHQUFHLFdBQVcsQ0FBQyxDQUFDLENBQUMsQ0FBQzt3QkFDMUIsSUFBTSxFQUFFLEdBQUcsV0FBVyxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQzt3QkFDOUIsSUFBSSxFQUFFLENBQUMsUUFBUSxFQUFFOzRCQUNiLFNBQVM7eUJBQ1o7d0JBQ0QsSUFBSSxpQkFBaUIsQ0FBQyxFQUFFLENBQUMsTUFBTyxFQUFFLEVBQUUsQ0FBQyxLQUFNLEVBQUUsRUFBRSxDQUFDLE1BQU8sRUFBRSxFQUFFLENBQUMsS0FBTSxDQUFDLEVBQUU7NEJBQ2pFLEVBQUUsQ0FBQyxPQUFPLEdBQUcsRUFBRSxDQUFDLE9BQU8sR0FBRyxJQUFJLENBQUM7eUJBQ2xDO3FCQUNKO2lCQUNKO2dCQUVELHdCQUF3QjtnQkFDeEIsS0FBSyxJQUFJLENBQUMsR0FBRyxDQUFDLEVBQUUsQ0FBQyxHQUFHLFdBQVcsQ0FBQyxNQUFNLEdBQUcsQ0FBQyxFQUFFLENBQUMsRUFBRSxFQUFFO29CQUM3QyxJQUFNLEVBQUUsR0FBRyxXQUFXLENBQUMsQ0FBQyxDQUFDLENBQUM7b0JBQzFCLElBQU0sRUFBRSxHQUFHLFdBQVcsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUM7b0JBQzlCLEtBQUssSUFBSSxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsR0FBRyxhQUFhLENBQUMsTUFBTSxFQUFFLENBQUMsRUFBRSxFQUFFO3dCQUMzQyxJQUFJLG1CQUFtQixDQUFDLEVBQUUsQ0FBQyxNQUFPLEVBQUUsRUFBRSxDQUFDLEtBQU0sRUFBRSxhQUFhLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBRyxFQUFFLGFBQWEsQ0FBQyxDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLEVBQUU7NEJBQy9GLEVBQUUsQ0FBQyxPQUFPLEdBQUcsSUFBSSxDQUFDOzRCQUNsQixLQUFLLENBQUMsS0FBSyxDQUFDLFdBQVcsR0FBRyxJQUFJLENBQUM7eUJBQ2xDO3FCQUNKO2lCQUNKO2dCQUNELDBCQUEwQjtnQkFDMUIsSUFBSSxRQUFRLEdBQUcsSUFBSSxDQUFDO2dCQUNwQixLQUFLLENBQUMsS0FBSyxDQUFDLFdBQVcsQ0FBQyxLQUFLLENBQUMsVUFBQSxVQUFVO29CQUNwQyxJQUFJLENBQUMsUUFBUSxFQUFFO3dCQUNYLE9BQU8sS0FBSyxDQUFDO3FCQUNoQjtvQkFDRCxJQUFJLFVBQVUsQ0FBQyxRQUFRLElBQUksQ0FBQyxVQUFVLENBQUMsT0FBTyxFQUFFO3dCQUM1QyxPQUFPLElBQUksQ0FBQztxQkFDZjtvQkFDRCxJQUFJLFVBQVUsQ0FBQyxNQUFNLENBQUMsS0FBSyxDQUFDLE9BQU8sRUFBRTt3QkFDakMsVUFBVSxDQUFDLE1BQU0sQ0FBQyxLQUFLLENBQUMsV0FBVyxHQUFHLElBQUksQ0FBQzt3QkFDM0MsS0FBSyxDQUFDLEtBQUssQ0FBQyxXQUFXLEdBQUcsSUFBSSxDQUFDO3dCQUMvQixPQUFPLEtBQUssQ0FBQztxQkFDaEI7b0JBRUQsVUFBVSxDQUFDLE1BQU0sQ0FBQyxLQUFLLENBQUMsT0FBTyxHQUFHLElBQUksQ0FBQztvQkFFdkMsSUFBSSxVQUFVLENBQUMsT0FBTyxFQUFFO3dCQUVwQixRQUFRLEdBQUcsS0FBSyxDQUFDO3FCQUNwQjt5QkFBTSxJQUFJLFVBQVUsQ0FBQyxNQUFNLENBQUMsS0FBSyxDQUFDLElBQUksSUFBSSxRQUFRLENBQUMsS0FBSyxFQUFDO3dCQUV0RCxnQkFBZ0IsRUFBRSxDQUFDO3FCQUN0QjtvQkFDRCxPQUFPLElBQUksQ0FBQztnQkFDaEIsQ0FBQyxDQUFDLENBQUM7Z0JBRUgsOEJBQThCO2dCQUM5QixJQUFJLFFBQVEsSUFBSSxZQUFZLENBQUMsTUFBTSxDQUFDLFNBQVMsSUFBSSxDQUFDLEtBQUssQ0FBQyxLQUFLLENBQUMsV0FBVyxJQUFJLGdCQUFnQixLQUFLLFNBQVMsRUFBRTtvQkFDekcsZ0JBQWdCLEVBQUUsQ0FBQztpQkFDdEI7Z0JBRUQsSUFBSSxnQkFBZ0IsSUFBSSxpQkFBaUIsRUFBRTtvQkFDdkMsUUFBUSxDQUFDLFNBQVMsR0FBRyxnQkFBZ0IsR0FBRyxLQUFLLEdBQUcsU0FBUyxDQUFDO2lCQUM3RDtnQkFHRCxpQkFBaUIsR0FBRyxnQkFBZ0IsQ0FBQztZQUV6QyxDQUFDLENBQUMsQ0FBQztRQUNQLENBQUM7S0FDSixDQUFDO0FBQ04sQ0FBQyxDQUFDO0FDdk1GLElBQUssSUFBMkI7QUFBaEMsV0FBSyxJQUFJO0lBQUUsZ0NBQVMsQ0FBQTtJQUFFLGlDQUFTLENBQUE7QUFBQSxDQUFDLEVBQTNCLElBQUksS0FBSixJQUFJLFFBQXVCO0FBRWhDLElBQUssUUFFSjtBQUZELFdBQUssUUFBUTtJQUNULHlDQUFLLENBQUE7SUFBRSx5Q0FBSyxDQUFBO0lBQUUscUNBQUcsQ0FBQTtJQUFFLHlDQUFLLENBQUE7SUFBRSwyQ0FBTSxDQUFBO0lBQUUsK0NBQVEsQ0FBQTtBQUM5QyxDQUFDLEVBRkksUUFBUSxLQUFSLFFBQVEsUUFFWjtBQXlGRCxxR0FBcUc7QUFFckc7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7R0FtQkc7QUN2SEgsSUFBTSxTQUFTLEdBQUcscUJBQXFCLENBQUM7QUFDeEMsSUFBTSxjQUFjLEdBQUcsVUFBQyxRQUFnQztJQUVwRCxJQUFJLFNBQWlCLENBQUM7SUFDdEIsSUFBSSxRQUFRLEdBQVcsS0FBSyxDQUFDO0lBQzdCLElBQUksUUFBUSxHQUFHLENBQUMsQ0FBQztJQUNqQixJQUFNLE1BQU0sR0FBRyxVQUFDLElBQVk7UUFDeEIsUUFBUSxDQUFDLElBQUksR0FBRyxLQUFLLENBQUMsQ0FBQztRQUN2QixJQUFJLENBQUMsUUFBUSxFQUFFO1lBQ1gsU0FBUyxHQUFHLFNBQVMsQ0FBQyxNQUFNLENBQUMsQ0FBQztTQUNqQztRQUNELFFBQVEsR0FBRyxJQUFJLENBQUM7SUFDcEIsQ0FBQyxDQUFDO0lBQ0YsU0FBUyxHQUFFLFNBQVMsQ0FBQyxNQUFNLENBQUMsQ0FBQztJQUU3QixPQUFPO1FBQ0gsUUFBUSxHQUFHLElBQUksQ0FBQztJQUNwQixDQUFDLENBQUM7QUFDTixDQUFDLENBQUM7QUFFRixJQUFNLEtBQUssR0FBRyxVQUFDLElBQVksRUFBRSxFQUFVLEVBQUUsUUFBZSxFQUFFLFFBQTZCLEVBQUUsVUFBc0I7SUFDM0csSUFBTSxTQUFTLEdBQUcsV0FBVyxDQUFDLEdBQUcsRUFBRSxDQUFDO0lBQ3BDLElBQU0sTUFBTSxHQUFHLFVBQUMsSUFBWTtRQUN4QixJQUFJLENBQUMsR0FBRyxDQUFDLEdBQUMsUUFBUSxHQUFHLENBQUMsSUFBSSxHQUFDLFNBQVMsQ0FBQyxHQUFDLEtBQUssQ0FBQztRQUM1QyxJQUFJLENBQUMsR0FBRyxDQUFDLEVBQUU7WUFDUCxRQUFRLENBQUMsSUFBSSxHQUFDLENBQUMsRUFBRSxHQUFDLElBQUksQ0FBQyxHQUFDLENBQUMsQ0FBQyxDQUFDO1lBQzNCLFNBQVMsQ0FBQyxNQUFNLENBQUMsQ0FBQztTQUNyQjthQUFNO1lBQ0gsUUFBUSxDQUFDLEVBQUUsQ0FBQyxDQUFDO1lBQ2IsU0FBUyxDQUFDLFVBQVUsQ0FBQyxDQUFDO1NBQ3pCO0lBQ0wsQ0FBQyxDQUFDO0lBQ0YsTUFBTSxDQUFDLFNBQVMsQ0FBQyxDQUFDO0FBQ3RCLENBQUMsQ0FBQztBQ2pDRixpQ0FBaUM7QUFDakMsaUNBQWlDO0FBQ2pDLHFDQUFxQztBQUNyQyxnQ0FBZ0M7QUFDaEMscUNBQXFDO0FBQ3JDLGdDQUFnQztBQUVoQyxJQUFNLGFBQWEsR0FBRztJQUNsQixPQUFPLENBQUMsU0FBUyxHQUFHLHFCQUFxQixDQUFDO0lBQzFDLE9BQU8sQ0FBQyxTQUFTLEdBQUcsT0FBTyxDQUFDO0lBQzVCLFdBQVcsQ0FBQyxnQkFBZ0IsRUFBRTtRQUMxQixPQUFPLENBQUMsZ0JBQWdCLENBQUMsT0FBTyxFQUFFLFVBQUEsQ0FBQztZQUMvQixRQUFRLENBQUMsTUFBTSxFQUFFLENBQUM7UUFDdEIsQ0FBQyxDQUFDLENBQUM7SUFDUCxDQUFDLENBQUMsQ0FBQztJQUNILFNBQVMsQ0FBQyxDQUFDLENBQUMsQ0FBQztBQUNqQixDQUFDLENBQUM7QUFFRixJQUFNLFNBQVMsR0FBRyxVQUFDLE1BQW1CLEVBQUUsU0FBb0IsRUFBRSxVQUFrQjtJQUM1RSxJQUFNLElBQUksR0FBRyxVQUFVLEVBQUUsQ0FBQztJQUMxQixJQUFJLFlBQVksR0FBRyxVQUFVLENBQUM7SUFFOUIsSUFBTSxjQUFjLEdBQUc7UUFDbkIsT0FBTyxDQUFDLEdBQUcsQ0FBQyxjQUFjLEdBQUcsWUFBWSxDQUFDLENBQUM7UUFFM0MsSUFBSSxRQUFxQixDQUFDO1FBQzFCLElBQUksWUFBWSxJQUFJLENBQUMsRUFBRTtZQUNuQixRQUFRLEdBQUcsU0FBUyxDQUFDLFNBQVMsQ0FBQztZQUMvQixXQUFXLENBQUMsV0FBVyxDQUFDLFFBQVEsQ0FBQyxDQUFDO1lBQ2xDLFdBQVcsQ0FBQyxRQUFRLENBQUMsQ0FBQztTQUN6QjtRQUNELElBQUksWUFBWSxJQUFJLENBQUMsRUFBRTtZQUNuQixRQUFRLEdBQUcsU0FBUyxDQUFDLFNBQVMsQ0FBQztZQUMvQixXQUFXLENBQUMsV0FBVyxDQUFDLFFBQVEsQ0FBQyxDQUFDO1lBQ2xDLFdBQVcsQ0FBQyxRQUFRLENBQUMsQ0FBQztTQUN6QjtRQUVELElBQU0sS0FBSyxHQUFHLElBQUksQ0FBQyxXQUFXLENBQUMsUUFBUSxDQUFDLE1BQU0sQ0FBQyxZQUFZLENBQUMsRUFBRSxTQUFTLEVBQUU7WUFDckUsSUFBSSxRQUFRLEVBQUU7Z0JBQ1YsV0FBVyxDQUFDLFFBQVEsRUFBRTtvQkFDbEIsYUFBYSxDQUFDLFFBQVEsQ0FBQyxDQUFDO2dCQUM1QixDQUFDLENBQUMsQ0FBQzthQUNOO1lBQ0QsSUFBSSxZQUFZLEdBQUcsUUFBUSxDQUFDLE1BQU0sQ0FBQyxNQUFNLEdBQUcsQ0FBQyxFQUFFO2dCQUMzQyxZQUFZLEVBQUUsQ0FBQztnQkFDZixTQUFTLENBQUMsWUFBWSxDQUFDLENBQUM7Z0JBQ3hCLFdBQVcsQ0FBQyxZQUFZLENBQUMsQ0FBQztnQkFDMUIsV0FBVyxDQUFDLENBQUMsZ0JBQWdCLENBQUMsRUFBRTtvQkFDNUIsT0FBTyxDQUFDLE9BQU8sR0FBRzt3QkFDZCxPQUFPLENBQUMsT0FBTyxHQUFHLElBQUksQ0FBQzt3QkFDdkIsV0FBVyxDQUFDLENBQUMsZ0JBQWdCLEVBQUUsS0FBSyxDQUFDLE1BQU0sRUFBRSxTQUFTLEVBQUUsUUFBUSxDQUFDLEVBQUU7NEJBQy9ELGFBQWEsQ0FBQyxLQUFLLENBQUMsTUFBTSxDQUFDLENBQUM7NEJBQzVCLGNBQWMsRUFBRSxDQUFDO3dCQUNyQixDQUFDLENBQUMsQ0FBQztvQkFFUCxDQUFDLENBQUM7Z0JBQ04sQ0FBQyxDQUFDLENBQUM7YUFDTjtpQkFBTTtnQkFDSCxhQUFhLEVBQUUsQ0FBQzthQUNuQjtRQUNMLENBQUMsQ0FBQyxDQUFDO1FBRUgsTUFBTSxDQUFDLFdBQVcsQ0FBQyxLQUFLLENBQUMsTUFBTSxDQUFDLENBQUM7UUFDakMsU0FBUyxDQUFDLFNBQVMsR0FBRyxRQUFRLEdBQUcsQ0FBQyxZQUFZLEdBQUcsQ0FBQyxDQUFDLENBQUM7UUFDcEQsV0FBVyxDQUFDLENBQUMsS0FBSyxDQUFDLE1BQU0sRUFBRSxZQUFZLEVBQUUsU0FBUyxFQUFFLFFBQVEsQ0FBQyxDQUFDLENBQUM7UUFFL0QsSUFBTSxVQUFVLEdBQUc7WUFDZixJQUFJLFFBQVEsRUFBRTtnQkFDVixXQUFXLENBQUMsUUFBUSxFQUFFO29CQUNsQixhQUFhLENBQUMsUUFBUSxDQUFDLENBQUM7Z0JBQzVCLENBQUMsQ0FBQyxDQUFDO2FBQ047WUFDRCxPQUFPLENBQUMsT0FBTyxHQUFHLE9BQU8sQ0FBQyxPQUFPLEdBQUcsUUFBUSxDQUFDLE9BQU8sR0FBRyxJQUFJLENBQUM7WUFDNUQsV0FBVyxDQUFDLENBQUMsS0FBSyxDQUFDLE1BQU0sRUFBRSxZQUFZLEVBQUUsU0FBUyxFQUFFLFFBQVEsQ0FBQyxFQUFFO2dCQUMzRCxLQUFLLENBQUMsUUFBUSxFQUFFLENBQUM7Z0JBQ2pCLGFBQWEsQ0FBQyxLQUFLLENBQUMsTUFBTSxDQUFDLENBQUM7Z0JBQzVCLGNBQWMsRUFBRSxDQUFDO1lBQ3JCLENBQUMsQ0FBQyxDQUFDO1FBRVAsQ0FBQyxDQUFDO1FBRUYsUUFBUSxDQUFDLE9BQU8sR0FBRyxVQUFVLENBQUM7UUFDOUIsT0FBTyxDQUFDLE9BQU8sR0FBRztZQUNkLElBQUksWUFBWSxHQUFHLFFBQVEsQ0FBQyxNQUFNLENBQUMsTUFBTSxHQUFHLENBQUMsRUFBRTtnQkFDM0MsT0FBTzthQUNWO1lBQ0QsWUFBWSxFQUFFLENBQUM7WUFDZixVQUFVLEVBQUUsQ0FBQztRQUNqQixDQUFDLENBQUM7UUFDRixPQUFPLENBQUMsT0FBTyxHQUFHO1lBQ2QsSUFBSSxZQUFZLEdBQUcsQ0FBQyxFQUFFO2dCQUNsQixPQUFPO2FBQ1Y7WUFDRCxZQUFZLEVBQUUsQ0FBQztZQUNmLFVBQVUsRUFBRSxDQUFDO1FBQ2pCLENBQUMsQ0FBQztJQUNOLENBQUMsQ0FBQztJQUVGLGNBQWMsRUFBRSxDQUFDO0FBQ3JCLENBQUMsQ0FBQztBQUVGLElBQU0sV0FBVyxHQUFHO0lBQ1YsSUFBQSx5QkFBNEMsRUFBM0Msa0JBQVUsRUFBRSxlQUFPLENBQXlCO0lBQ25ELFVBQVUsQ0FBQyxFQUFFLEdBQUcsWUFBWSxDQUFDO0lBQzdCLGNBQWMsQ0FBQyxXQUFXLENBQUMsVUFBVSxDQUFDLENBQUM7SUFDdkMsV0FBVyxDQUFDLFVBQVUsQ0FBQyxDQUFDO0lBQ3hCLE9BQU8sQ0FBQyxXQUFXLEdBQUcsTUFBTSxDQUFDO0lBQzdCLE9BQU8sQ0FBQyxTQUFTLEdBQUcsTUFBTSxDQUFDO0lBQzNCLE9BQU8sQ0FBQyxTQUFTLEdBQUcsQ0FBQyxDQUFDO0lBRXRCLE9BQU8sQ0FBQyxVQUFVLENBQUMsR0FBRyxFQUFFLEdBQUcsRUFBRSxHQUFHLEVBQUUsQ0FBQyxDQUFDLENBQUM7SUFDckMsaUJBQWlCLENBQUMsVUFBQSxDQUFDO1FBQ2YsT0FBTyxDQUFDLFFBQVEsQ0FBQyxHQUFHLEVBQUUsR0FBRyxFQUFFLEdBQUcsR0FBRyxHQUFHLEdBQUcsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDO0lBQ2pELENBQUMsRUFBRSxVQUFDLFNBQVM7UUFFVCxXQUFXLENBQUMsVUFBVSxFQUFFO1lBQ3BCLFdBQVcsQ0FBQyxDQUFDLFdBQVcsRUFBRSxrQkFBa0IsQ0FBQyxDQUFDLENBQUM7WUFFL0MsSUFBTSxVQUFVLEdBQUcsU0FBUyxFQUFFLENBQUM7WUFDL0IsV0FBVyxDQUFDLEtBQUssQ0FBQyxVQUFVLEdBQUcsVUFBVSxDQUFDLENBQUMsQ0FBQyxTQUFTLENBQUMsQ0FBQyxDQUFDLFFBQVEsQ0FBQztZQUVqRSxJQUFNLGtCQUFrQixHQUFHLFVBQUMsVUFBa0I7Z0JBQzFDLFFBQVEsQ0FBQyxPQUFPLEdBQUcsV0FBVyxDQUFDLE9BQU8sR0FBRyxJQUFJLENBQUM7Z0JBQzlDLFdBQVcsQ0FBQyxDQUFDLFlBQVksRUFBRSxXQUFXLEVBQUUsa0JBQWtCLENBQUMsRUFBRTtvQkFDekQsU0FBUyxDQUFDLGNBQWMsRUFBRSxTQUFTLEVBQUUsVUFBVSxDQUFDLENBQUM7Z0JBQ3JELENBQUMsQ0FBQyxDQUFDO1lBQ1AsQ0FBQyxDQUFDO1lBQ0YsUUFBUSxDQUFDLE9BQU8sR0FBRztnQkFDZixTQUFTLENBQUMsQ0FBQyxDQUFDLENBQUM7Z0JBQ2Isa0JBQWtCLENBQUMsQ0FBQyxDQUFDLENBQUM7WUFDMUIsQ0FBQyxDQUFDO1lBRUYsV0FBVyxDQUFDLE9BQU8sR0FBRztnQkFDbEIsa0JBQWtCLENBQUMsVUFBVSxDQUFDLENBQUM7WUFDbkMsQ0FBQyxDQUFDO1lBRUYsaUVBQWlFO1FBQ3JFLENBQUMsQ0FBQyxDQUFDO0lBRVAsQ0FBQyxDQUFDLENBQUM7QUFDUCxDQUFDLENBQUM7QUFFRixXQUFXLENBQUMsWUFBWSxFQUFFLFdBQVcsQ0FBQyxDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiY29uc3QgY3JlYXRlQ2FudmFzID0gKHdpZHRoOiBudW1iZXIsIGhlaWdodDogbnVtYmVyKTogW0NhbnZhcywgQ29udGV4dF0gPT4ge1xuICAgIGNvbnN0IGNhbnZhcyA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2NhbnZhcycpO1xuICAgIGNhbnZhcy53aWR0aCA9IHdpZHRoO1xuICAgIGNhbnZhcy5oZWlnaHQgPSBoZWlnaHQ7XG4gICAgY29uc3QgY29udGV4dCA9IGNhbnZhcy5nZXRDb250ZXh0KCcyZCcpIGFzIENvbnRleHQ7XG4gICAgcmV0dXJuIFtjYW52YXMsIGNvbnRleHRdO1xufTtcbiIsImNvbnN0IGNyZWF0ZUdhbWUgPSAoKSA9PiB7XG5cbiAgICBjb25zdCBiYWNrZ3JvdW5kID0gY3JlYXRlR2FtZUJhY2tncm91bmQoKTtcblxuICAgIGNvbnN0IGNyZWF0ZUxldmVsID0gKGxldmVsRGF0YTogTGV2ZWxEYXRhLCByZXNvdXJjZXM6IFJlc291cmNlcywgb25MZXZlbEZpbmlzaDogKCkgPT4gdm9pZCkgPT4ge1xuXG4gICAgICAgIGNvbnN0IFtjYW52YXMsIGNvbnRleHRdID0gY3JlYXRlQ2FudmFzKDEyODAsIDcyMCk7XG4gICAgICAgIGNvbnN0IHNwYWNlID0gY3JlYXRlU3BhY2UoKTtcblxuICAgICAgICBsZXQgY2FuY2VsRnJhbWVMb29wOiAoKSA9PiB2b2lkO1xuICAgICAgICBjb25zdCBpbnB1dENvbnRyb2wgPSBjcmVhdGVJbnB1dENvbnRyb2woY2FudmFzKTtcbiAgICAgICAgY29uc3Qgc3Bvb2xSZW5kZXJTeXN0ZW0gPSBjcmVhdGVTcG9vbFJlbmRlclN5c3RlbShyZXNvdXJjZXMpO1xuICAgICAgICBjb25zdCBjYWJsZVJlbmRlclN5c3RlbSA9IGNyZWF0ZUNhYmxlUmVuZGVyU3lzdGVtKCk7XG5cbiAgICAgICAgY29uc3Qgc2h1dGRvd24gPSBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICBjYW5jZWxGcmFtZUxvb3AoKTtcbiAgICAgICAgICAgIGlucHV0Q29udHJvbC5zaHV0ZG93bigpO1xuICAgICAgICAgICAgc3BhY2Uuc2h1dGRvd24oKTtcbiAgICAgICAgICAgIGRvY3VtZW50LmJvZHkuc3R5bGUuY3Vyc29yID0gJ2RlZmF1bHQnO1xuICAgICAgICB9O1xuICAgICAgICBjb25zdCBzcG9vbFN5c3RlbSA9IGNyZWF0ZVNwb29sU3lzdGVtKCgpID0+IHtcbiAgICAgICAgICAgIHNodXRkb3duKCk7XG4gICAgICAgICAgICBvbkxldmVsRmluaXNoKCk7XG4gICAgICAgIH0pO1xuICAgICAgICBjb25zdCBtb3VzZURyYWdTeXN0ZW0gPSBjcmVhdGVNb3VzZURyYWdTeXN0ZW0oaW5wdXRDb250cm9sKTtcblxuXG4gICAgICAgIC8vIHVuY29tbWVudCB0aGlzIGxpbmVzIGFuZCB0aGUgbGluZSBhdCB0aGUgYm90dG9tIHRvIGVuYWJsZSBlZGl0b3IgbW9kZVxuICAgICAgICAvLyBjb25zdCBsZXZlbEVkaXRvclN5c3RlbSA9IGNyZWF0ZUxldmVsRWRpdG9yU3lzdGVtKHNwYWNlLCBpbnB1dENvbnRyb2wpO1xuICAgICAgICAvLyBzcGFjZS5yZWdpc3RlclN5c3RlbShsZXZlbEVkaXRvclN5c3RlbSk7XG5cblxuICAgICAgICBzcGFjZS5yZWdpc3RlclN5c3RlbShzcG9vbFJlbmRlclN5c3RlbSk7XG4gICAgICAgIHNwYWNlLnJlZ2lzdGVyU3lzdGVtKHNwb29sU3lzdGVtKTtcbiAgICAgICAgc3BhY2UucmVnaXN0ZXJTeXN0ZW0oY2FibGVSZW5kZXJTeXN0ZW0pO1xuICAgICAgICBzcGFjZS5yZWdpc3RlclN5c3RlbShtb3VzZURyYWdTeXN0ZW0pO1xuXG5cbiAgICAgICAgbGV2ZWxEYXRhLnNwb29scy5mb3JFYWNoKChzcG9vbERhdGEpID0+IHtcbiAgICAgICAgICAgIGNvbnN0IHNwb29sRW50aXR5OiBTcG9vbE5vZGVFbnRpdHkgPSB7XG4gICAgICAgICAgICAgICAgcG9zOiB7eDogc3Bvb2xEYXRhWzBdLCB5OiBzcG9vbERhdGFbMV19LFxuICAgICAgICAgICAgICAgIHNwb29sOiB7c2l6ZTogc3Bvb2xEYXRhWzJdLCB0eXBlOiBOb2RlVHlwZS5zcG9vbH0sXG4gICAgICAgICAgICAgICAgcmVuZGVyOiB7dHlwZTogTm9kZVR5cGUuc3Bvb2x9LFxuICAgICAgICAgICAgfTtcblxuICAgICAgICAgICAgc3BhY2UuYWRkRW50aXR5KHNwb29sRW50aXR5KTtcbiAgICAgICAgfSk7XG5cbiAgICAgICAgbGV2ZWxEYXRhLmJsb2Nrcy5mb3JFYWNoKChibG9jaykgPT4ge1xuICAgICAgICAgICAgY29uc3QgYmxvY2tFbnRpdHk6IEJsb2NrTm9kZUVudGl0eSA9IHtcbiAgICAgICAgICAgICAgICBwb3M6IHt4OiBibG9ja1swXSwgeTogYmxvY2tbMV19LFxuICAgICAgICAgICAgICAgIGJsb2NrOiB7c2l6ZTogYmxvY2tbMl19LFxuICAgICAgICAgICAgICAgIHJlbmRlcjoge3R5cGU6IE5vZGVUeXBlLmJsb2NrfVxuICAgICAgICAgICAgfTtcbiAgICAgICAgICAgIHNwYWNlLmFkZEVudGl0eShibG9ja0VudGl0eSk7XG4gICAgICAgIH0pO1xuXG4gICAgICAgIGxldmVsRGF0YS5pc29sYXRvcnMuZm9yRWFjaCgoaXNvbGF0b3IpID0+IHtcbiAgICAgICAgICAgIGNvbnN0IGJsb2NrRW50aXR5OiBTcG9vbE5vZGVFbnRpdHkgPSB7XG4gICAgICAgICAgICAgICAgcG9zOiB7eDogaXNvbGF0b3JbMF0sIHk6IGlzb2xhdG9yWzFdfSxcbiAgICAgICAgICAgICAgICBzcG9vbDoge3NpemU6IGlzb2xhdG9yWzJdLCB0eXBlOiBOb2RlVHlwZS5pc29sYXRvcn0sXG4gICAgICAgICAgICAgICAgcmVuZGVyOiB7dHlwZTogTm9kZVR5cGUuaXNvbGF0b3J9XG4gICAgICAgICAgICB9O1xuICAgICAgICAgICAgc3BhY2UuYWRkRW50aXR5KGJsb2NrRW50aXR5KTtcbiAgICAgICAgfSk7XG5cbiAgICAgICAgY29uc3Qgc3RhcnQ6IFN0YXJ0Tm9kZUVudGl0eSA9IHtcbiAgICAgICAgICAgIHBvczoge3g6IGxldmVsRGF0YS5zdGFydFswXSwgeTogbGV2ZWxEYXRhLnN0YXJ0WzFdfSxcbiAgICAgICAgICAgIHNwb29sOiB7c2l6ZTogMCwgdHlwZTogTm9kZVR5cGUuc3RhcnR9LFxuICAgICAgICAgICAgcmVuZGVyOiB7dHlwZTogTm9kZVR5cGUuc3RhcnR9XG4gICAgICAgIH07XG5cbiAgICAgICAgY29uc3QgZW5kOiBFbmROb2RlRW50aXR5ID0ge1xuICAgICAgICAgICAgcG9zOiB7eDogbGV2ZWxEYXRhLmVuZFswXSwgeTogbGV2ZWxEYXRhLmVuZFsxXX0sXG4gICAgICAgICAgICBzcG9vbDoge3NpemU6IDAsIHR5cGU6IE5vZGVUeXBlLmVuZH0sXG4gICAgICAgICAgICByZW5kZXI6IHt0eXBlOiBOb2RlVHlwZS5lbmR9LFxuICAgICAgICAgICAgbW91c2VEcmFnOiB7c2l6ZTogMzB9XG4gICAgICAgIH07XG5cbiAgICAgICAgY29uc3QgY2FibGU6IENhYmxlRW50aXR5ID0ge1xuICAgICAgICAgICAgY2FibGU6IHthdHRhY2htZW50czogW3tlbnRpdHk6IHN0YXJ0IGFzIFNwb29sRW50aXR5LCBzaWRlOiBTaWRlLmxlZnR9LCB7ZW50aXR5OiBlbmQgYXMgU3Bvb2xFbnRpdHksIHNpZGU6IFNpZGUubGVmdH1dfVxuICAgICAgICB9O1xuXG4gICAgICAgIGNvbnN0IGZpbmlzaDogRmluaXNoRW50aXR5ID0ge1xuICAgICAgICAgICAgZmluaXNoOiB7fSxcbiAgICAgICAgICAgIHJlbmRlcjoge3R5cGU6IE5vZGVUeXBlLmZpbmlzaH0sXG4gICAgICAgICAgICBwb3M6IHt4OiBsZXZlbERhdGEuZmluaXNoWzBdLCB5OiBsZXZlbERhdGEuZmluaXNoWzFdfVxuICAgICAgICB9O1xuXG4gICAgICAgIC8vVE9ETzogcmVuZGVyIGxheWVyc1xuICAgICAgICBzcGFjZS5hZGRFbnRpdHkoc3RhcnQpO1xuICAgICAgICBzcGFjZS5hZGRFbnRpdHkoZmluaXNoKTtcbiAgICAgICAgc3BhY2UuYWRkRW50aXR5KGVuZCk7XG4gICAgICAgIHNwYWNlLmFkZEVudGl0eShjYWJsZSk7XG5cbiAgICAgICAgY29uc3QgdXBkYXRlID0gKHRpbWU6IG51bWJlcikgPT4ge1xuICAgICAgICAgICAgbW91c2VEcmFnU3lzdGVtLnVwZGF0ZSh0aW1lKTtcbiAgICAgICAgICAgIHNwb29sU3lzdGVtLnVwZGF0ZSh0aW1lKTtcbiAgICAgICAgICAgIC8vIGxldmVsRWRpdG9yU3lzdGVtLnVwZGF0ZSh0aW1lKTtcbiAgICAgICAgfTtcblxuICAgICAgICBjb25zdCByZW5kZXIgPSAodGltZTogbnVtYmVyKSA9PiB7XG4gICAgICAgICAgICBjb250ZXh0LmRyYXdJbWFnZShiYWNrZ3JvdW5kLCAwLDApO1xuXG4gICAgICAgICAgICBjYWJsZVJlbmRlclN5c3RlbS5yZW5kZXIoY29udGV4dCwgdGltZSk7XG4gICAgICAgICAgICBzcG9vbFJlbmRlclN5c3RlbS5yZW5kZXIoY29udGV4dCwgdGltZSk7XG4gICAgICAgIH07XG5cbiAgICAgICAgY2FuY2VsRnJhbWVMb29wID0gc3RhcnRGcmFtZUxvb3AodGltZSA9PiB7XG4gICAgICAgICAgICB1cGRhdGUodGltZSk7XG4gICAgICAgICAgICByZW5kZXIodGltZSk7XG4gICAgICAgIH0pO1xuICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgY2FudmFzLFxuICAgICAgICAgICAgc2h1dGRvd25cbiAgICAgICAgfTtcbiAgICB9O1xuXG4gICAgcmV0dXJuIHtcbiAgICAgICAgY3JlYXRlTGV2ZWxcbiAgICB9O1xufTtcblxuXG5cbiIsIi8vIGh0dHBzOi8vZ2lzdC5naXRodWIuY29tL2JsaXh0L2YxN2I0N2M2MjUwOGJlNTk5ODdiXG5jb25zdCBjbGFtcCA9IChudW06IG51bWJlciwgbWluOiBudW1iZXIsIG1heDogbnVtYmVyKTogbnVtYmVyID0+IG51bSA8IG1pbiA/IG1pbiA6IG51bSA+IG1heCA/IG1heCA6IG51bTtcblxuLy8gaHR0cHM6Ly9naXN0LmdpdGh1Yi5jb20vSm9uY29tL2U4ZThkMThlYmU3ZmU1NWMzODk0XG5jb25zdCBsaW5lTGluZUludGVyc2VjdCA9IChsaW5lMWE6IFZlYzIsIGxpbmUxYjogVmVjMiwgbGluZTJhOiBWZWMyLCBsaW5lMmI6IFZlYzIpOiBib29sZWFuID0+IHtcbiAgICAvLyB2YXIgczFfeCwgczFfeSwgczJfeCwgczJfeTtcbiAgICBjb25zdCBzMV94ID0gbGluZTFiLnggLSBsaW5lMWEueDtcbiAgICBjb25zdCBzMV95ID0gbGluZTFiLnkgLSBsaW5lMWEueTtcbiAgICBjb25zdCBzMl94ID0gbGluZTJiLnggLSBsaW5lMmEueDtcbiAgICBjb25zdCBzMl95ID0gbGluZTJiLnkgLSBsaW5lMmEueTtcblxuICAgIC8vIHZhciBzLCB0O1xuICAgIGNvbnN0IHMgPSAoLXMxX3kgKiAobGluZTFhLnggLSBsaW5lMmEueCkgKyBzMV94ICogKGxpbmUxYS55IC0gbGluZTJhLnkpKSAvICgtczJfeCAqIHMxX3kgKyBzMV94ICogczJfeSk7XG4gICAgY29uc3QgdCA9IChzMl94ICogKGxpbmUxYS55IC0gbGluZTJhLnkpIC0gczJfeSAqIChsaW5lMWEueCAtIGxpbmUyYS54KSkgLyAoLXMyX3ggKiBzMV95ICsgczFfeCAqIHMyX3kpO1xuXG4gICAgcmV0dXJuIHMgPj0gMCAmJiBzIDw9IDEgJiYgdCA+PSAwICYmIHQgPD0gMTtcbn07XG5cbi8vIGJvcnJvd2VkIGZyb20gaHR0cHM6Ly9jb2RlcmV2aWV3LnN0YWNrZXhjaGFuZ2UuY29tL3F1ZXN0aW9ucy8xOTI0NzcvY2lyY2xlLWxpbmUtc2VnbWVudC1jb2xsaXNpb25cbmNvbnN0IGxpbmVDaXJjbGVJbnRlcnNlY3QgPSAobGluZUE6IFZlYzIsIGxpbmVCOiBWZWMyLCBjaXJjbGU6IFZlYzIsIHJhZGl1czogbnVtYmVyKTogYm9vbGVhbiA9PiB7XG4gICAgbGV0IGRpc3Q7XG4gICAgY29uc3QgdjF4ID0gbGluZUIueCAtIGxpbmVBLng7XG4gICAgY29uc3QgdjF5ID0gbGluZUIueSAtIGxpbmVBLnk7XG4gICAgY29uc3QgdjJ4ID0gY2lyY2xlLnggLSBsaW5lQS54O1xuICAgIGNvbnN0IHYyeSA9IGNpcmNsZS55IC0gbGluZUEueTtcbiAgICAvLyBnZXQgdGhlIHVuaXQgZGlzdGFuY2UgYWxvbmcgdGhlIGxpbmUgb2YgdGhlIGNsb3Nlc3QgcG9pbnQgdG9cbiAgICAvLyBjaXJjbGUgY2VudGVyXG4gICAgY29uc3QgdSA9ICh2MnggKiB2MXggKyB2MnkgKiB2MXkpIC8gKHYxeSAqIHYxeSArIHYxeCAqIHYxeCk7XG5cbiAgICAvLyBpZiB0aGUgcG9pbnQgaXMgb24gdGhlIGxpbmUgc2VnbWVudCBnZXQgdGhlIGRpc3RhbmNlIHNxdWFyZWRcbiAgICAvLyBmcm9tIHRoYXQgcG9pbnQgdG8gdGhlIGNpcmNsZSBjZW50ZXJcbiAgICBpZiAodSA+PSAwICYmIHUgPD0gMSkge1xuICAgICAgICBkaXN0ID0gKGxpbmVBLnggKyB2MXggKiB1IC0gY2lyY2xlLngpICoqIDIgKyAobGluZUEueSArIHYxeSAqIHUgLSBjaXJjbGUueSkgKiogMjtcbiAgICB9IGVsc2Uge1xuICAgICAgICAvLyBpZiBjbG9zZXN0IHBvaW50IG5vdCBvbiB0aGUgbGluZSBzZWdtZW50XG4gICAgICAgIC8vIHVzZSB0aGUgdW5pdCBkaXN0YW5jZSB0byBkZXRlcm1pbmUgd2hpY2ggZW5kIGlzIGNsb3Nlc3RcbiAgICAgICAgLy8gYW5kIGdldCBkaXN0IHNxdWFyZSB0byBjaXJjbGVcbiAgICAgICAgZGlzdCA9IHUgPCAwID9cbiAgICAgICAgICAgIChsaW5lQS54IC0gY2lyY2xlLngpICoqIDIgKyAobGluZUEueSAtIGNpcmNsZS55KSAqKiAyIDpcbiAgICAgICAgICAgIChsaW5lQi54IC0gY2lyY2xlLngpICoqIDIgKyAobGluZUIueSAtIGNpcmNsZS55KSAqKiAyO1xuICAgIH1cbiAgICByZXR1cm4gZGlzdCA8IHJhZGl1cyAqIHJhZGl1cztcbn07XG5cbi8vIGh0dHBzOi8vanNmaWRkbGUubmV0L01hZExpdHRsZU1vZHMvMGVoMHpleXUvXG5jb25zdCBkaXN0MiA9IChwdDE6IFZlYzIsIHB0MjogVmVjMikgPT4gTWF0aC5wb3cocHQxLnggLSBwdDIueCwgMikgKyBNYXRoLnBvdyhwdDEueSAtIHB0Mi55LCAyKTtcblxuLy8gaHR0cHM6Ly9lbi53aWtpYm9va3Mub3JnL3dpa2kvQWxnb3JpdGhtX0ltcGxlbWVudGF0aW9uL0dlb21ldHJ5L1RhbmdlbnRzX2JldHdlZW5fdHdvX2NpcmNsZXNcbmNvbnN0IGdldFRhbmdlbnRzID0gKHAxOiBWZWMyLCByMTogbnVtYmVyLCBwMjogVmVjMiwgcjI6IG51bWJlcik6IFZlYzJbXVtdID0+IHtcbiAgICBsZXQgZF9zcSA9IChwMS54IC0gcDIueCkgKiAocDEueCAtIHAyLngpICsgKHAxLnkgLSBwMi55KSAqIChwMS55IC0gcDIueSk7XG5cbiAgICBpZiAoZF9zcSA8PSAocjEgLSByMikgKiAocjEgLSByMikpIHJldHVybiBbXTtcblxuICAgIGxldCBkID0gTWF0aC5zcXJ0KGRfc3EpO1xuICAgIGxldCB2eCA9IChwMi54IC0gcDEueCkgLyBkO1xuICAgIGxldCB2eSA9IChwMi55IC0gcDEueSkgLyBkO1xuXG4gICAgLy8gZG91YmxlW11bXSByZXMgPSBuZXcgZG91YmxlWzRdWzRdO1xuICAgIGxldCByZXN1bHQgPSBbXTtcbiAgICBsZXQgaSA9IDA7XG5cbiAgICAvLyBMZXQgQSwgQiBiZSB0aGUgY2VudGVycywgYW5kIEMsIEQgYmUgcG9pbnRzIGF0IHdoaWNoIHRoZSB0YW5nZW50XG4gICAgLy8gdG91Y2hlcyBmaXJzdCBhbmQgc2Vjb25kIGNpcmNsZSwgYW5kIG4gYmUgdGhlIG5vcm1hbCB2ZWN0b3IgdG8gaXQuXG4gICAgLy9cbiAgICAvLyBXZSBoYXZlIHRoZSBzeXN0ZW06XG4gICAgLy8gICBuICogbiA9IDEgICAgICAgICAgKG4gaXMgYSB1bml0IHZlY3RvcilcbiAgICAvLyAgIEMgPSBBICsgcjEgKiBuXG4gICAgLy8gICBEID0gQiArLy0gcjIgKiBuXG4gICAgLy8gICBuICogQ0QgPSAwICAgICAgICAgKGNvbW1vbiBvcnRob2dvbmFsaXR5KVxuICAgIC8vXG4gICAgLy8gbiAqIENEID0gbiAqIChBQiArLy0gcjIqbiAtIHIxKm4pID0gQUIqbiAtIChyMSAtLysgcjIpID0gMCwgIDw9PlxuICAgIC8vIEFCICogbiA9IChyMSAtLysgcjIpLCA8PT5cbiAgICAvLyB2ICogbiA9IChyMSAtLysgcjIpIC8gZCwgIHdoZXJlIHYgPSBBQi98QUJ8ID0gQUIvZFxuICAgIC8vIFRoaXMgaXMgYSBsaW5lYXIgZXF1YXRpb24gaW4gdW5rbm93biB2ZWN0b3Igbi5cblxuICAgIGZvciAobGV0IHNpZ24xID0gKzE7IHNpZ24xID49IC0xOyBzaWduMSAtPSAyKSB7XG4gICAgICAgIGxldCBjID0gKHIxIC0gc2lnbjEgKiByMikgLyBkO1xuXG4gICAgICAgIC8vIE5vdyB3ZSdyZSBqdXN0IGludGVyc2VjdGluZyBhIGxpbmUgd2l0aCBhIGNpcmNsZTogdipuPWMsIG4qbj0xXG5cbiAgICAgICAgaWYgKGMgKiBjID4gMS4wKSBjb250aW51ZTtcbiAgICAgICAgbGV0IGggPSBNYXRoLnNxcnQoTWF0aC5tYXgoMC4wLCAxLjAgLSBjICogYykpO1xuXG4gICAgICAgIGZvciAobGV0IHNpZ24yID0gKzE7IHNpZ24yID49IC0xOyBzaWduMiAtPSAyKSB7XG4gICAgICAgICAgICBsZXQgbnggPSB2eCAqIGMgLSBzaWduMiAqIGggKiB2eTtcbiAgICAgICAgICAgIGxldCBueSA9IHZ5ICogYyArIHNpZ24yICogaCAqIHZ4O1xuICAgICAgICAgICAgcmVzdWx0W2ldID0gW107XG4gICAgICAgICAgICBjb25zdCBhID0gcmVzdWx0W2ldID0gbmV3IEFycmF5KDIpO1xuICAgICAgICAgICAgYVswXSA9IHt4OiBwMS54ICsgcjEgKiBueCwgeTogcDEueSArIHIxICogbnl9O1xuICAgICAgICAgICAgYVsxXSA9IHt4OiBwMi54ICsgc2lnbjEgKiByMiAqIG54LCB5OiBwMi55ICsgc2lnbjEgKiByMiAqIG55fTtcbiAgICAgICAgICAgIGkrKztcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHJldHVybiByZXN1bHQ7XG59O1xuXG5cbmNvbnN0IHNpZGVPZkxpbmUgPSAocDE6IFZlYzIsIHAyOiBWZWMyLCBwOiBWZWMyKTogU2lkZSA9PiAoKHAyLnggLSBwMS54KSAqIChwLnkgLSBwMS55KSAtIChwMi55IC0gcDEueSkgKiAocC54IC0gcDEueCkpID4gMCA/IFNpZGUubGVmdCA6IFNpZGUucmlnaHQ7XG5cbiIsIi8vLyA8cmVmZXJlbmNlIHBhdGg9XCJtYXRoLXV0aWwudHNcIiAvPlxuY29uc3QgZnJhY3QgPSAobjpudW1iZXIpID0+ICAoKG4gJSAxKSArIDEpICUgMTtcblxuY29uc3Qgc3ViViA9ICh2MTogVmVjMiwgdjI6IFZlYzIpOiBWZWMyID0+ICh7eDogdjEueCAtIHYyLngsIHk6IHYxLnkgLSB2Mi55fSk7XG5jb25zdCBhZGRWID0gKHYxOiBWZWMyLCB2MjogVmVjMik6IFZlYzIgPT4gKHt4OiB2MS54ICsgdjIueCwgeTogdjEueSArIHYyLnl9KTtcbmNvbnN0IG11bFZTID0gKHY6IFZlYzIsIHM6IG51bWJlcik6IFZlYzIgPT4gKHt4OiB2LnggKiBzLCB5OiB2LnkgKiBzfSk7XG5jb25zdCBkaXZWUyA9ICh2OiBWZWMyLCBzOiBudW1iZXIpOiBWZWMyID0+IG11bFZTKHYsIDEgLyBzKTtcbmNvbnN0IGxlblYgPSAodjogVmVjMik6IG51bWJlciA9PiBNYXRoLnNxcnQodi54ICogdi54ICsgdi55ICogdi55KTtcbmNvbnN0IGRpc3RWID0gKHYxOiBWZWMyLCB2MjogVmVjMik6IG51bWJlciA9PiBsZW5WKHN1YlYodjEsIHYyKSk7XG5jb25zdCBub3JtYWxpemVWID0gKHY6IFZlYzIpOiBWZWMyID0+IGRpdlZTKHYsIGxlblYodikgfHwgMSk7XG5jb25zdCBwZXJwTGVmdFYgPSAodjogVmVjMikgPT4gKHt4OiAtdi55LCB5OiB2Lnh9KTtcbmNvbnN0IHBlcnBSaWdodFYgPSAodjogVmVjMikgPT4gKHt4OiB2LnksIHk6IC12Lnh9KTtcbmNvbnN0IGFuZ2xlViA9ICh2OiBWZWMyKTogbnVtYmVyID0+IHtcbiAgICBsZXQgYW5nbGUgPSBNYXRoLmF0YW4yKHYueSwgdi54KTtcbiAgICBpZiAoYW5nbGUgPCAwKSBhbmdsZSArPSAyICogTWF0aC5QSTtcbiAgICByZXR1cm4gYW5nbGU7XG59O1xuY29uc3QgY29weUludG9WID0gKHRhcmdldDogVmVjMiwgc291cmNlOiBWZWMyKTogdm9pZCA9PiB7XG4gICAgdGFyZ2V0LnggPSBzb3VyY2UueDtcbiAgICB0YXJnZXQueSA9IHNvdXJjZS55O1xufTtcbmNvbnN0IGNvcHlWID0gKHNvdXJjZTogVmVjMik6IFZlYzIgPT4gKHt4OnNvdXJjZS54LCB5OiBzb3VyY2UueX0pO1xuY29uc3QgZnJhY3RWID0gKHY6IFZlYzIpID0+ICh7eDogZnJhY3Qodi54KSwgeTogZnJhY3Qodi55KX0pO1xuY29uc3QgZmxvb3JWID0gKHY6IFZlYzIpID0+ICh7eDogfn52LngsIHk6IH5+di55fSk7XG4iLCIvLy8gPHJlZmVyZW5jZSBwYXRoPVwiY2FudmFzLnRzXCIgLz5cbi8vLyA8cmVmZXJlbmNlIHBhdGg9XCJ2ZWN0b3IudHNcIiAvPlxuXG5jb25zdCBtaXggPSAoYTogbnVtYmVyLCBiOiBudW1iZXIsIG06IG51bWJlcikgPT4gKDEgLSBtKSAqIGEgKyBtICogYjtcbmNvbnN0IG1peENvbCA9IChhOiBDb2xvciwgYjogQ29sb3IsIG06IG51bWJlcik6IENvbG9yID0+ICh7XG4gICAgcjogbWl4KGEuciwgYi5yLCBtKSxcbiAgICBnOiBtaXgoYS5nLCBiLmcsIG0pLFxuICAgIGI6IG1peChhLmIsIGIuYiwgbSksXG4gICAgYTogbWl4KGEuYSwgYi5hLCBtKSxcbn0pO1xuXG5jb25zdCBoYWxmViA9IHt4OiAwLjUsIHk6IDAuNX07XG5jb25zdCB2MTAgPSB7eDogMSwgeTogMH07XG5jb25zdCB2MDEgPSB7eDogMCwgeTogMX07XG5jb25zdCB2MTEgPSB7eDogMSwgeTogMX07XG5jb25zdCBuMjEgPSAodjogVmVjMik6IG51bWJlciA9PiAoKE1hdGguc2luKHYueCAqIDEwMCArIHYueSAqIDY1NzQpICsgMSkgKiA1NjQpICUgMTtcblxuY29uc3Qgbm9pc2UgPSAodjogVmVjMik6IG51bWJlciA9PiB7XG4gICAgY29uc3QgbHYgPSBmcmFjdFYodik7XG4gICAgY29uc3QgaWQgPSBmbG9vclYodik7XG4gICAgY29uc3QgYmwgPSBuMjEoaWQpO1xuICAgIGNvbnN0IGJyID0gbjIxKGFkZFYoaWQsIHYxMCkpO1xuICAgIGNvbnN0IGIgPSBtaXgoYmwsIGJyLCBsdi54KTtcblxuICAgIGNvbnN0IHRsID0gbjIxKGFkZFYoaWQsIHYwMSkpO1xuICAgIGNvbnN0IHRyID0gbjIxKGFkZFYoaWQsIHYxMSkpO1xuXG4gICAgY29uc3QgdCA9IG1peCh0bCwgdHIsIGx2LngpO1xuXG4gICAgcmV0dXJuIG1peChiLCB0LCBsdi55KTtcbn07XG5jb25zdCBzbW9vdGhzdGVwID0gKG1pbjogbnVtYmVyLCBtYXg6IG51bWJlciwgdmFsdWU6IG51bWJlcikgPT4ge1xuICAgIGNvbnN0IHggPSBjbGFtcCgodmFsdWUgLSBtaW4pIC8gKG1heCAtIG1pbiksIDAsIDEpO1xuICAgIHJldHVybiB4ICogeCAqICgzIC0gMiAqIHgpO1xufTtcbmNvbnN0IG5ld0NvbCA9IChyOiBudW1iZXIgPSAxLCBnOiBudW1iZXIgPSAxLCBiOiBudW1iZXIgPSAxLCBhOiBudW1iZXIgPSAxKTogQ29sb3IgPT4gKHtyLCBnLCBiLCBhfSk7XG5jb25zdCBtdWxDb2wgPSAoY29sb3I6IENvbG9yLCB2OiBudW1iZXIpID0+ICh7XG4gICAgcjogY29sb3IuciAqIHYsXG4gICAgZzogY29sb3IuZyAqIHYsXG4gICAgYjogY29sb3IuYiAqIHYsXG4gICAgYTogY29sb3IuYVxufSk7XG5cbmNvbnN0IGFkZENvbCA9IChhOiBDb2xvciwgYjogQ29sb3IpID0+IHtcbiAgICByZXR1cm4ge1xuICAgICAgICByOiBhLnIgKyBiLnIgKiBiLmEsXG4gICAgICAgIGc6IGEuZyArIGIuZyAqIGIuYSxcbiAgICAgICAgYjogYS5iICsgYi5iICogYi5hLFxuICAgICAgICBhOiBhLmEgKyBiLmFcbiAgICB9O1xufTtcbmNvbnN0IGdlbmVyYXRlSW1hZ2UgPSAod2lkdGg6IG51bWJlciwgaGVpZ2h0OiBudW1iZXIsIGNiOiAodjogVmVjMikgPT4gQ29sb3IpID0+IHtcbiAgICBjb25zdCBbY2FudmFzLCBjb250ZXh0XSA9IGNyZWF0ZUNhbnZhcyh3aWR0aCwgaGVpZ2h0KTtcbiAgICBjb25zdCBpbWFnZURhdGEgPSBjb250ZXh0LmdldEltYWdlRGF0YSgwLCAwLCB3aWR0aCwgaGVpZ2h0KTtcbiAgICBjb25zdCBidWYgPSBuZXcgQXJyYXlCdWZmZXIoaW1hZ2VEYXRhLmRhdGEubGVuZ3RoKTtcbiAgICBjb25zdCBidWY4ID0gbmV3IFVpbnQ4Q2xhbXBlZEFycmF5KGJ1Zik7XG4gICAgY29uc3QgZGF0YTMyID0gbmV3IFVpbnQzMkFycmF5KGJ1Zik7XG4gICAgY29uc3QgdjogUGFydGlhbDxWZWMyPiA9IHt9O1xuXG4gICAgZm9yIChsZXQgeSA9IDA7IHkgPCBoZWlnaHQ7IHkrKykge1xuICAgICAgICBmb3IgKGxldCB4ID0gMDsgeCA8IHdpZHRoOyB4KyspIHtcbiAgICAgICAgICAgIHYueCA9IHggLyAod2lkdGggLSAxKTtcbiAgICAgICAgICAgIHYueSA9IHkgLyAoaGVpZ2h0IC0gMSk7XG4gICAgICAgICAgICBjb25zdCBjID0gY2IodiBhcyBWZWMyKTtcbiAgICAgICAgICAgIGRhdGEzMlt5ICogd2lkdGggKyB4XSA9XG4gICAgICAgICAgICAgICAgKGNsYW1wKGMuYSEgKiAyNTUsIDAsIDI1NSkgPDwgMjQpIHwgICAgLy8gYWxwaGFcbiAgICAgICAgICAgICAgICAoY2xhbXAoYy5iISAqIDI1NSwgMCwgMjU1KSA8PCAxNikgfCAgICAvLyBibHVlXG4gICAgICAgICAgICAgICAgKGNsYW1wKGMuZyEgKiAyNTUsIDAsIDI1NSkgPDwgOCkgfCAgICAvLyBncmVlblxuICAgICAgICAgICAgICAgIGNsYW1wKGMuciEgKiAyNTUsIDAsIDI1NSk7XG4gICAgICAgIH1cbiAgICB9XG4gICAgaW1hZ2VEYXRhLmRhdGEuc2V0KGJ1ZjgpO1xuICAgIGNvbnRleHQucHV0SW1hZ2VEYXRhKGltYWdlRGF0YSwgMCwgMCk7XG5cbiAgICByZXR1cm4gY2FudmFzO1xufTtcblxuLy8gaHR0cHM6Ly9naXN0LmdpdGh1Yi5jb20vc2FrcmlzdC84NzA2NzQ5XG5jb25zdCBjcmVhdGVIZXhGaWVsZCA9ICh2OiBWZWMyLCBzY2FsZTogbnVtYmVyKTogbnVtYmVyID0+IHtcbiAgICBsZXQge3gsIHl9ID0gbXVsVlModiwgc2NhbGUpO1xuICAgIHggKj0gMC41NzczNSAqIDIuMDtcbiAgICB5ICs9IChNYXRoLmZsb29yKHgpICUgMikgKiAwLjU7XG4gICAgeCA9IE1hdGguYWJzKHggJSAxIC0gMC41KTtcbiAgICB5ID0gTWF0aC5hYnMoeSAlIDEgLSAwLjUpO1xuICAgIHJldHVybiBNYXRoLmFicyhNYXRoLm1heCh4ICogMS41ICsgeSwgeSAqIDIuMCkgLSAxLjApO1xufTtcblxuY29uc3QgY3JlYXRlTWV0YWxQbGF0ZSA9IChhOiBudW1iZXIsIGQ6IG51bWJlcik6IG51bWJlciA9PiB7XG4gICAgY29uc3Qgc2hhZGluZyA9IHNtb290aHN0ZXAoMC45MSwgMC45NCwgZCkgLSBzbW9vdGhzdGVwKDAuNDEsIDAuNDIsIGQpO1xuICAgIGEgKz0gc2hhZGluZztcbiAgICByZXR1cm4gMC45ICsgMC4xICogTWF0aC5zaW4oYSAqIDYpICogMC45ICsgMC4xICogTWF0aC5zaW4oYSAqIDQpXG4gICAgICAgIC0gKG5vaXNlKHt4OiAoYSArIDQgKyBkICogNSkgKiAyLCB5OiBkICogODB9KSAqIDAuMSkgKyBzaGFkaW5nICogMC4yO1xufTtcblxuY29uc3QgY3JlYXRlQ29pbFNwcml0ZSA9IChzaXplOiBudW1iZXIpOiBDYW52YXMgPT4ge1xuICAgIGNvbnN0IHN3ID0gNCAvIHNpemU7XG4gICAgY29uc3QgaGV4RmllbGRTY2FsZSA9IHNpemUgLyA0O1xuICAgIGNvbnN0IGhleEZpZWxkQnJpZ2h0bmVzcyA9IDAuNztcbiAgICBjb25zdCByaW5nQnJpZ2h0bmVzcyA9IDAuNDtcbiAgICBjb25zdCBncmlkU2hhZG93Qmx1ciA9IDAuMTtcbiAgICBjb25zdCBncmlkU2hhZG93U3RyZW5ndGggPSAxO1xuICAgIGNvbnN0IHJpbmdXaWR0aCA9IDAuMjtcbiAgICBjb25zdCBidXR0b25TaXplID0gMC41O1xuICAgIGNvbnN0IGdyaWRDb2xvciA9IG5ld0NvbCgwLjYxNSwgMC43MDUsIDEsIDEpO1xuICAgIGNvbnN0IG1ldGFsQ29sb3IgPSBuZXdDb2woMSwgMSwgMSwgMSk7XG4gICAgY29uc3Qgc2hhZG93Qmx1ciA9IDAuMjtcbiAgICBjb25zdCBzaGFkb3dEaXN0YW5jZSA9IDAuMDQ7XG4gICAgY29uc3Qgc2hhZG93U2NhbGUgPSAxLjE7XG4gICAgY29uc3Qgc2hhZG93U3RyZW5ndGggPSAwLjU7XG5cbiAgICBjb25zdCBpbWFnZSA9IGdlbmVyYXRlSW1hZ2UoTWF0aC5yb3VuZChzaXplICogMS4xKSwgTWF0aC5yb3VuZChzaXplICogMS4xKSwgdiA9PiB7XG4gICAgICAgIHYgPSBtdWxWUyh2LCAxLjEpOyAvLyBzY2FsZSB0byBtYWtlIHJvb20gZm9yIHNoYWRvd1xuICAgICAgICBjb25zdCBjZW50ZXJWID0gc3ViVih2LCBoYWxmVik7XG4gICAgICAgIGNvbnN0IGEgPSBNYXRoLmF0YW4yKGNlbnRlclYueSwgY2VudGVyVi54KTtcbiAgICAgICAgY29uc3QgZCA9IGxlblYoY2VudGVyVikgKiAyO1xuICAgICAgICBsZXQgZ3JpZCA9IGhleEZpZWxkQnJpZ2h0bmVzcyAqIHNtb290aHN0ZXAoMC4zLCAxLCAxIC0gY3JlYXRlSGV4RmllbGQodiwgaGV4RmllbGRTY2FsZSkpOyAvLyBUT0RPOiBGT1IgU1BPT0xcbiAgICAgICAgY29uc3QgZ3JpZFNoYWRvdyA9IDEgLSAoc21vb3Roc3RlcCgxIC0gcmluZ1dpZHRoICogMC42NSwgMSAtIHJpbmdXaWR0aCAtIGdyaWRTaGFkb3dCbHVyLCBkKSAtXG4gICAgICAgICAgICBzbW9vdGhzdGVwKGJ1dHRvblNpemUgKyBncmlkU2hhZG93Qmx1ciwgYnV0dG9uU2l6ZSAqIDAuODUsIGQpKTtcbiAgICAgICAgZ3JpZCAtPSAoZ3JpZFNoYWRvdyAqIGdyaWRTaGFkb3dTdHJlbmd0aCk7XG5cbiAgICAgICAgY29uc3QgbWV0YWxQbGF0ZSA9IGNyZWF0ZU1ldGFsUGxhdGUoYSwgZCkgKiByaW5nQnJpZ2h0bmVzcztcbiAgICAgICAgY29uc3QgcmluZ01hc2sgPSBzbW9vdGhzdGVwKDEgLSByaW5nV2lkdGgsIDEgLSByaW5nV2lkdGggKyBzdywgZCkgKyBzbW9vdGhzdGVwKGJ1dHRvblNpemUsIGJ1dHRvblNpemUgLSBzdywgZCk7XG4gICAgICAgIGNvbnN0IHNwcml0ZUNvbCA9IG1peENvbChtdWxDb2woZ3JpZENvbG9yLCBncmlkKSwgbXVsQ29sKG1ldGFsQ29sb3IsIG1ldGFsUGxhdGUpLCByaW5nTWFzayk7XG5cbiAgICAgICAgY29uc3Qgc2hhZG93ID0gc21vb3Roc3RlcCgxLCAxIC0gc2hhZG93Qmx1ciwgbGVuVihzdWJWKGNlbnRlclYsIHtcbiAgICAgICAgICAgIHg6IHNoYWRvd0Rpc3RhbmNlLFxuICAgICAgICAgICAgeTogc2hhZG93RGlzdGFuY2VcbiAgICAgICAgfSkpICogMiAvIHNoYWRvd1NjYWxlKSAqIHNoYWRvd1N0cmVuZ3RoO1xuICAgICAgICBjb25zdCBzaGFkb3dDb2wgPSBuZXdDb2woMCwgMCwgMCwgc2hhZG93KTtcblxuICAgICAgICByZXR1cm4gbWl4Q29sKHNwcml0ZUNvbCwgc2hhZG93Q29sLCBzbW9vdGhzdGVwKDEgLSBzdywgMSwgZCkpO1xuICAgIH0pO1xuXG4gICAgcmV0dXJuIGltYWdlO1xuXG59O1xuXG5jb25zdCBjcmVhdGVJc29sYXRvclNwcml0ZSA9IChzaXplOiBudW1iZXIpOiBDYW52YXMgPT4ge1xuICAgIGNvbnN0IHN3ID0gNCAvIHNpemU7XG4gICAgY29uc3QgaGV4RmllbGRTY2FsZSA9IHNpemUgLyA4O1xuICAgIGNvbnN0IGhleEZpZWxkQnJpZ2h0bmVzcyA9IDAuNztcbiAgICBjb25zdCByaW5nQnJpZ2h0bmVzcyA9IDAuNDtcbiAgICBjb25zdCBncmlkU2hhZG93Qmx1ciA9IDAuMjtcbiAgICBjb25zdCBncmlkU2hhZG93U3RyZW5ndGggPSAwLjY7XG4gICAgY29uc3QgcmluZ1dpZHRoID0gMC4xNTtcbiAgICBjb25zdCBidXR0b25TaXplID0gMC4zO1xuICAgIGNvbnN0IGdyaWRDb2xvciA9IG5ld0NvbCgwLjgxNSwgMC4yNzA1LCAuMiwgMSk7IC8vIGlzb2xhdGUgcmVkXG4gICAgY29uc3QgbWV0YWxDb2xvciA9IG5ld0NvbCgxLCAxLCAxLCAxKTtcbiAgICBjb25zdCBzaGFkb3dCbHVyID0gMC4yO1xuICAgIGNvbnN0IHNoYWRvd0Rpc3RhbmNlID0gMC4wNDtcbiAgICBjb25zdCBzaGFkb3dTY2FsZSA9IDEuMTtcbiAgICBjb25zdCBzaGFkb3dTdHJlbmd0aCA9IDAuNTtcblxuICAgIGNvbnN0IGltYWdlID0gZ2VuZXJhdGVJbWFnZShNYXRoLnJvdW5kKHNpemUgKiAxLjEpLCBNYXRoLnJvdW5kKHNpemUgKiAxLjEpLCB2ID0+IHtcbiAgICAgICAgdiA9IG11bFZTKHYsIDEuMSk7IC8vIHNjYWxlIHRvIG1ha2Ugcm9vbSBmb3Igc2hhZG93XG4gICAgICAgIGNvbnN0IGNlbnRlclYgPSBzdWJWKHYsIGhhbGZWKTtcbiAgICAgICAgY29uc3QgYSA9IE1hdGguYXRhbjIoY2VudGVyVi55LCBjZW50ZXJWLngpOyAvLyBwb2xhciB4XG4gICAgICAgIGNvbnN0IGQgPSBsZW5WKGNlbnRlclYpICogMjsgICAgICAgICAgICAgICAgLy8gcG9sYXIgeVxuICAgICAgICBsZXQgZ3JpZCA9IGhleEZpZWxkQnJpZ2h0bmVzcyAqIHNtb290aHN0ZXAoMC4wMiwgMC40MSwgMSAtIGNyZWF0ZUhleEZpZWxkKHYsIGhleEZpZWxkU2NhbGUpKTsgLy8gVE9ETyBGT1IgSVNPTEFUT1JcbiAgICAgICAgY29uc3QgZ3JpZFNoYWRvdyA9IDEgLSAoc21vb3Roc3RlcCgxIC0gcmluZ1dpZHRoICogMC42NSwgMSAtIHJpbmdXaWR0aCAtIGdyaWRTaGFkb3dCbHVyLCBkKSAtXG4gICAgICAgICAgICBzbW9vdGhzdGVwKGJ1dHRvblNpemUgKyBncmlkU2hhZG93Qmx1ciwgYnV0dG9uU2l6ZSAqIDAuODUsIGQpKTtcbiAgICAgICAgZ3JpZCAtPSAoZ3JpZFNoYWRvdyAqIGdyaWRTaGFkb3dTdHJlbmd0aCk7XG5cbiAgICAgICAgY29uc3QgbWV0YWxQbGF0ZSA9IGNyZWF0ZU1ldGFsUGxhdGUoYSwgZCkgKiByaW5nQnJpZ2h0bmVzcztcbiAgICAgICAgY29uc3QgcmluZ01hc2sgPSBzbW9vdGhzdGVwKDEgLSByaW5nV2lkdGgsIDEgLSByaW5nV2lkdGggKyBzdywgZCkgKyBzbW9vdGhzdGVwKGJ1dHRvblNpemUsIGJ1dHRvblNpemUgLSBzdywgZCk7XG4gICAgICAgIGNvbnN0IHNwcml0ZUNvbCA9IG1peENvbChtdWxDb2woZ3JpZENvbG9yLCBncmlkKSwgbXVsQ29sKG1ldGFsQ29sb3IsIG1ldGFsUGxhdGUpLCByaW5nTWFzayk7XG5cbiAgICAgICAgY29uc3Qgc2hhZG93ID0gc21vb3Roc3RlcCgxLCAxIC0gc2hhZG93Qmx1ciwgbGVuVihzdWJWKGNlbnRlclYsIHtcbiAgICAgICAgICAgIHg6IHNoYWRvd0Rpc3RhbmNlLFxuICAgICAgICAgICAgeTogc2hhZG93RGlzdGFuY2VcbiAgICAgICAgfSkpICogMiAvIHNoYWRvd1NjYWxlKSAqIHNoYWRvd1N0cmVuZ3RoO1xuICAgICAgICBjb25zdCBzaGFkb3dDb2wgPSBuZXdDb2woMCwgMCwgMCwgc2hhZG93KTtcblxuICAgICAgICByZXR1cm4gbWl4Q29sKHNwcml0ZUNvbCwgc2hhZG93Q29sLCBzbW9vdGhzdGVwKDEgLSBzdywgMSwgZCkpO1xuICAgIH0pO1xuXG4gICAgcmV0dXJuIGltYWdlO1xuXG59O1xuXG5jb25zdCBjcmVhdGVHZWFyID0gKHB4Om51bWJlciwgcHk6bnVtYmVyLCBvdXRlclNpemU6IG51bWJlciwgaW5uZXJTaXplOm51bWJlciwgc3RlcDogbnVtYmVyKTogbnVtYmVyID0+IHtcbiAgICBjb25zdCBzID0gTWF0aC5taW4oZnJhY3QocHgpLCBmcmFjdCgxIC0gcHgpKSAqIDI7XG4gICAgY29uc3Qgc3Bpa2VzID0gc21vb3Roc3RlcCgwLCBzdGVwKjgsIHMgLSBweSk7XG4gICAgY29uc3QgY2VudGVyID0gc21vb3Roc3RlcChpbm5lclNpemUsIGlubmVyU2l6ZStzdGVwLCAxIC0gcHkpO1xuICAgIGNvbnN0IGN1dCA9IHNtb290aHN0ZXAob3V0ZXJTaXplK3N0ZXAsb3V0ZXJTaXplICwgMSAtIHB5KTtcbiAgICByZXR1cm4gY2xhbXAoc3Bpa2VzICtjZW50ZXIgLSBjdXQsIDAsMSk7XG59O1xuXG5jb25zdCBjcmVhdGVCbG9ja1Nwcml0ZSA9IChzaXplOiBudW1iZXIpOiBDYW52YXMgPT4ge1xuICAgIGNvbnN0IGltYWdlID0gZ2VuZXJhdGVJbWFnZShzaXplLCBzaXplLCB2ID0+IHtcbiAgICAgICAgY29uc3QgY3YgPSBzdWJWKHYsIGhhbGZWKTtcbiAgICAgICAgY29uc3QgZCA9IGxlblYoY3YpICogMjtcbiAgICAgICAgY29uc3QgYXRhbiA9IE1hdGguYXRhbjIoY3YueSwgY3YueCk7XG4gICAgICAgIGNvbnN0IHB4ID0gYXRhbiAvIChNYXRoLlBJICogMikgKyAwLjU7ICAgIC8vIHBvbGFyIHR3aXN0ZWRNeFxuICAgICAgICBjb25zdCB0d2lzdGVkUHggPSBhdGFuIC8gKE1hdGguUEkgKiAyKSArIDAuNSArIGQgKiAwLjM7ICAgIC8vIHBvbGFyIHR3aXN0ZWRNeFxuICAgICAgICBjb25zdCB0d2lzdGVkTXggPSB0d2lzdGVkUHggKiBNYXRoLnJvdW5kKDgrc2l6ZS81MCk7XG4gICAgICAgIGNvbnN0IG14ID0gcHggKiBNYXRoLnJvdW5kKDUrc2l6ZS8yMDApO1xuICAgICAgICBjb25zdCBtID0gTWF0aC5taW4oZnJhY3QodHdpc3RlZE14KSwgZnJhY3QoMSAtIHR3aXN0ZWRNeCkpO1xuICAgICAgICBsZXQgYmxhZGVBbHBoYSA9IHNtb290aHN0ZXAoMC4wLCAwLjA4LCBtICogMC41IC0gZCArIDAuNyk7XG4gICAgICAgIGxldCBzaGFkb3cgPSAxLXNtb290aHN0ZXAoMC45LCAwLjIsIGQpO1xuICAgICAgICBsZXQgYmxhZGUgPSAxLjQgKiBkIC0gYmxhZGVBbHBoYSAqIDAuNTtcbiAgICAgICAgbGV0IGdlYXIgPSBjcmVhdGVHZWFyKG14LCBkLCAwLjQ1LCAwLjUyLCAwLjAyKTtcbiAgICAgICAgbGV0IGdlYXJDb2wgPSAwLjUrMC41KmNyZWF0ZU1ldGFsUGxhdGUoYXRhbioxLCBkKTtcbiAgICAgICAgYmxhZGUgPSBtaXgobWl4KHNoYWRvdywgYmxhZGUsIGJsYWRlQWxwaGEpLCBnZWFyKjAuMypnZWFyQ29sLCBnZWFyKTtcbiAgICAgICAgcmV0dXJuIG5ld0NvbChibGFkZSwgYmxhZGUsIGJsYWRlLCBibGFkZUFscGhhKygxLXNoYWRvdykpO1xuICAgIH0pO1xuICAgIHJldHVybiBpbWFnZTtcblxufTtcblxuY29uc3QgY3JlYXRlSW5uZXJTaGFkb3cgPSAodjogVmVjMik6IENvbG9yID0+IHtcbiAgICBjb25zdCBkID0gbGVuVih2KSAqIDI7XG4gICAgY29uc3QgZG0gPSBsZW5WKHN1YlYodiwgbXVsVlModjExLCAwLjA1KSkpICogMjtcbiAgICBjb25zdCB2YWwgPSBzbW9vdGhzdGVwKDEsIDAuNSwgZG0gKiAwLjgpICogMC4yO1xuICAgIGNvbnN0IGEgPSBzbW9vdGhzdGVwKDEsIDAuODUsIGQpO1xuICAgIHJldHVybiBuZXdDb2wodmFsLCB2YWwsIHZhbCwgYSk7XG59O1xuY29uc3QgY3JlYXRlTGVkR2xhc3MgPSAodjogVmVjMik6IENvbG9yID0+IHtcbiAgICBjb25zdCBkID0gKGxlblYodikgKiAyKSAqIDEuMjtcbiAgICBjb25zdCB2YWwgPSBzbW9vdGhzdGVwKDEsIDAuMCwgZCkgKiAwLjI1O1xuICAgIGNvbnN0IGEgPSBzbW9vdGhzdGVwKDAuOTksIDAuOSwgZCk7XG4gICAgcmV0dXJuIG5ld0NvbCh2YWwsIHZhbCwgdmFsLCBhKTtcbn07XG5jb25zdCBjcmVhdGVMZWRHbGFzc1JlZmxlY3Rpb24gPSAodjogVmVjMik6IENvbG9yID0+IHtcbiAgICBjb25zdCBkID0gKGxlblYodikgKiAyKSAqIDEuNTtcbiAgICBjb25zdCBkbSA9IGxlblYoc3ViVih2LCBtdWxWUyh2MTEsIDAuMTQpKSkgKiAxLjAxO1xuICAgIGNvbnN0IHZhbCA9IHNtb290aHN0ZXAoMSwgMC42LCBkKSAqXG4gICAgICAgIHNtb290aHN0ZXAoMC4yLCAwLjUsIGRtKTtcbiAgICByZXR1cm4gbmV3Q29sKHZhbCwgdmFsLCB2YWwsIHZhbCk7XG59O1xuY29uc3QgY3JlYXRlTGVkU3ByaXRlID0gKCk6IENhbnZhcyA9PiBnZW5lcmF0ZUltYWdlKDIxLCAyMSwgdiA9PiB7XG4gICAgY29uc3QgY3YgPSBzdWJWKHYsIGhhbGZWKTtcbiAgICBjb25zdCBpbm5lclNoYWRvdyA9IGNyZWF0ZUlubmVyU2hhZG93KGN2KTtcbiAgICBjb25zdCBsZWRHbGFzcyA9IGNyZWF0ZUxlZEdsYXNzKGN2KTtcbiAgICBjb25zdCBsZWRHbGFzc1JlZmxlY3Rpb24gPSBjcmVhdGVMZWRHbGFzc1JlZmxlY3Rpb24oY3YpO1xuXG4gICAgcmV0dXJuIGFkZENvbChhZGRDb2woaW5uZXJTaGFkb3csIGxlZEdsYXNzKSwgbGVkR2xhc3NSZWZsZWN0aW9uKTtcbn0pO1xuXG5jb25zdCB3aGl0ZSA9IG5ld0NvbCgxLCAxLCAxLCAxKTtcbmNvbnN0IGNyZWF0ZUdsb3cgPSAoY29sb3I6Q29sb3IpOiBDYW52YXMgPT4gZ2VuZXJhdGVJbWFnZSg4MCwgODAsIHYgPT4ge1xuICAgIGNvbnN0IGN2ID0gc3ViVih2LCBoYWxmVik7XG4gICAgY29uc3QgZCA9IDEgLSBsZW5WKGN2KSAqIDI7XG4gICAgY29uc3QgcmVzdWx0ID0gbWl4Q29sKGNvbG9yLCB3aGl0ZSwgc21vb3Roc3RlcCgwLjYsIDAuODksIGQpKTtcblxuICAgIGNvbnN0IGEgPSBzbW9vdGhzdGVwKDAuMCwgMSwgZCk7XG4gICAgcmV0dXJuIG5ld0NvbChyZXN1bHQuciwgcmVzdWx0LmcsIHJlc3VsdC5iLCBhKmEqYSk7XG59KTtcblxuY29uc3QgY3JlYXRlTWV0YWwgPSAoYTogbnVtYmVyLCBkOiBudW1iZXIpOiBudW1iZXIgPT4ge1xuICAgIHJldHVybiAwLjkgKyAwLjEgKiBNYXRoLnNpbihhICogNikgKiAwLjkgKyAwLjEgKiBNYXRoLnNpbihhICogNClcbiAgICAgICAgLSAobm9pc2Uoe3g6IChhICsgNCArIGQgKiA1KSAqIDIsIHk6IGQgKiA4MH0pICogMC4xKTtcbn07XG5cbmNvbnN0IGNyZWF0ZVJpbmdHbG93ID0gKGNvbG9yOkNvbG9yKTogQ2FudmFzID0+IGdlbmVyYXRlSW1hZ2UoNjIsIDYyLCB2ID0+IHtcbiAgICBjb25zdCBjdiA9IHN1YlYodiwgaGFsZlYpO1xuICAgIGNvbnN0IGQgPSAxIC0gbGVuVihjdikgKiAyO1xuICAgIGNvbnN0IHJlc3VsdCA9IG1peENvbChjb2xvciwgd2hpdGUsIHNtb290aHN0ZXAoMC40NSwgMC41LCBkKSpzbW9vdGhzdGVwKDAuNTUsIDAuNSwgZCkpO1xuICAgIGNvbnN0IGEgPSBzbW9vdGhzdGVwKDAuMCwgMC41LCBkKSpzbW9vdGhzdGVwKDEsIDAuNSwgZCk7XG4gICAgcmV0dXJuIG5ld0NvbChyZXN1bHQuciwgcmVzdWx0LmcsIHJlc3VsdC5iLCBhKmEqYSk7XG59KTtcblxuXG5jb25zdCBjcmVhdGVDb25uZWN0b3JCdXR0b25zID0gKGxpZ2h0Q29sb3I6Q29sb3IsIHNpemU6bnVtYmVyKTogQ2FudmFzID0+IHtcbiAgICBjb25zdCBzaGFkb3dCbHVyID0gMC4yO1xuICAgIGNvbnN0IHNoYWRvd0Rpc3RhbmNlID0gMC4wNDtcbiAgICBjb25zdCBzaGFkb3dTY2FsZSA9IDEuMTtcbiAgICBjb25zdCBzaGFkb3dTdHJlbmd0aCA9IDAuMjtcbiAgICBjb25zdCBpbWFnZSA9IGdlbmVyYXRlSW1hZ2Uoc2l6ZSwgc2l6ZSwgdiA9PiB7XG4gICAgICAgIHYgPSBtdWxWUyh2LCAxLjEpOyAvLyBzY2FsZSB0byBtYWtlIHJvb20gZm9yIHNoYWRvd1xuICAgICAgICBjb25zdCBjdiA9IHN1YlYodiwgaGFsZlYpO1xuXG4gICAgICAgIGNvbnN0IGF0YW4gPSBNYXRoLmF0YW4yKGN2LnksIGN2LngpO1xuICAgICAgICBjb25zdCBweSA9IGxlblYoY3YpICogMjtcblxuICAgICAgICAvLyBiYWNrXG4gICAgICAgIGNvbnN0IGJhY2tBbHBoYSA9IHNtb290aHN0ZXAoMSwgLjk2LCBweSk7XG4gICAgICAgIGxldCBzaGFkaW5nID0gc21vb3Roc3RlcCgwLjksIDAuODAsIHB5KSowLjMrMC4zO1xuICAgICAgICBzaGFkaW5nIC09IHNtb290aHN0ZXAoMC43LCAwLjYwLCBweSkgKiBzbW9vdGhzdGVwKDAuMiwgMC4zMCwgcHkpICogMC40O1xuICAgICAgICBjb25zdCBiYWNrVmFsID0gY3JlYXRlTWV0YWwoYXRhbisoc2hhZGluZyozKSwgcHkpICogc2hhZGluZztcbiAgICAgICAgY29uc3QgYmFja0NvbCA9IG5ld0NvbChiYWNrVmFsLCBiYWNrVmFsLCBiYWNrVmFsLCBiYWNrQWxwaGEpO1xuXG4gICAgICAgIC8vIGxpZ2h0XG4gICAgICAgIGNvbnN0IGxpZ2h0QWxwaGEgPSBzbW9vdGhzdGVwKDAuMzUsIDAuNDUsIHB5KSpzbW9vdGhzdGVwKDAuNTUsIDAuNDUsIHB5KTtcblxuICAgICAgICBjb25zdCBjb2wgPSBtaXhDb2woYmFja0NvbCwgbGlnaHRDb2xvciwgbGlnaHRBbHBoYSk7XG4gICAgICAgIGNvbnN0IHNoYWRvdyA9IHNtb290aHN0ZXAoMSwgMSAtIHNoYWRvd0JsdXIsIGxlblYoc3ViVihjdiwge1xuICAgICAgICAgICAgeDogc2hhZG93RGlzdGFuY2UsXG4gICAgICAgICAgICB5OiBzaGFkb3dEaXN0YW5jZVxuICAgICAgICB9KSkgKiAyIC8gc2hhZG93U2NhbGUpICogc2hhZG93U3RyZW5ndGg7XG4gICAgICAgIGNvbnN0IHNoYWRvd0NvbCA9IG5ld0NvbCgwLCAwLCAwLCBzaGFkb3cpO1xuICAgICAgICByZXR1cm4gbWl4Q29sKGNvbCwgc2hhZG93Q29sLCBzbW9vdGhzdGVwKDAuOCwgMSwgcHkpKTtcbiAgICB9KTtcbiAgICByZXR1cm4gaW1hZ2U7XG59O1xuXG5jb25zdCBjcmVhdGVHYW1lQmFja2dyb3VuZCA9ICgpOiBDYW52YXMgPT4ge1xuICAgIGNvbnN0IFtjYW52YXMsIGNvbnRleHRdID0gY3JlYXRlQ2FudmFzKDE5MjAsIDEyODApO1xuICAgIGNvbnN0IGltYWdlID0gZ2VuZXJhdGVJbWFnZSg2NCwgNjQsIHYgPT4ge1xuICAgICAgICBjb25zdCBtID0gbXVsVlModiwgNCk7XG4gICAgICAgIGNvbnN0IGNvbCA9IDEtc21vb3Roc3RlcCgwLjcsIDEsIGNyZWF0ZUhleEZpZWxkKG0sIDEpKSowLjc7XG4gICAgICAgIHJldHVybiBuZXdDb2woY29sICogMC4xMTcsIGNvbCAqIDAuMTQ5LCBjb2wgKiAwLjE4OCwgMSk7XG4gICAgfSk7XG5cbiAgICBjb25zdCBoaWdobGlnaHQgPSBnZW5lcmF0ZUltYWdlKDEyOCoyLCA3MioyLCB2ID0+IHtcbiAgICAgICAgY29uc3QgdyA9IDAuMDE7XG4gICAgICAgIGNvbnN0IGMgPSBzbW9vdGhzdGVwKDAsIHcqMC42LCB2LngpKnNtb290aHN0ZXAoMSwgMS13KjAuNiwgdi54KSpcbiAgICAgICAgICAgIHNtb290aHN0ZXAoMCwgdywgdi55KSpzbW9vdGhzdGVwKDEsIDEtdywgdi55KTtcblxuICAgICAgICByZXR1cm4gbmV3Q29sKDEsIDEsIDEsICgxLWMpKjAuMDQpO1xuICAgIH0pO1xuXG4gICAgZm9yIChsZXQgeSA9IDA7IHkgPCAxMjsgeSsrKSB7XG4gICAgICAgIGZvciAobGV0IHggPSAwOyB4IDwgMjQ7IHgrKykge1xuICAgICAgICAgICAgY29udGV4dC5kcmF3SW1hZ2UoaW1hZ2UsIHggKiA1NCwgeSAqIDYzKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGNvbnRleHQuZHJhd0ltYWdlKGhpZ2hsaWdodCwgMCwgMCwgMTI4MCwgNzIwKTtcbiAgICByZXR1cm4gY2FudmFzO1xufTtcblxuIiwiXG5jb25zdCBlbGVtZW50QnlJZCA9IChpZDogYW55KSA9PiBkb2N1bWVudC5nZXRFbGVtZW50QnlJZChpZCk7XG5cbmNvbnN0IHRpdGxlRWxlbWVudCA9IGVsZW1lbnRCeUlkKCd0aXRsZScpIGFzIEhUTUxFbGVtZW50O1xuY29uc3QgZ2FtZUVsZW1lbnQgPSBlbGVtZW50QnlJZCgnZ2FtZScpIGFzIEhUTUxFbGVtZW50O1xuY29uc3QgbG9hZGluZ0VsZW1lbnQgPSBlbGVtZW50QnlJZCgnbG9hZGluZycpIGFzIEhUTUxFbGVtZW50O1xuY29uc3QgbWVudUVsZW1lbnQgPSBlbGVtZW50QnlJZCgnbWVudScpIGFzIEhUTUxFbGVtZW50O1xuY29uc3QgbGV2ZWxEb25lRWxlbWVudCA9IGVsZW1lbnRCeUlkKCdsZXZlbERvbmUnKSBhcyBIVE1MRWxlbWVudDtcbmNvbnN0IG5leHRNc2cgPSBlbGVtZW50QnlJZCgnbmV4dE1zZycpIGFzIEhUTUxFbGVtZW50O1xuY29uc3QgbmV4dEJ0biA9IGVsZW1lbnRCeUlkKCduZXh0QnRuJykgYXMgSFRNTEVsZW1lbnQ7XG5jb25zdCBzdGFydEJ0biA9IGVsZW1lbnRCeUlkKCdzdGFydEJ0bicpIGFzIEhUTUxFbGVtZW50O1xuY29uc3QgY29udGludWVCdG4gPSBlbGVtZW50QnlJZCgnY29udGludWVCdG4nKSBhcyBIVE1MRWxlbWVudDtcbmNvbnN0IGNvbnRlbnRFbGVtZW50ID0gZWxlbWVudEJ5SWQoJ2NvbnRlbnQnKSBhcyBIVE1MRWxlbWVudDtcbmNvbnN0IHJlc2V0RWxlbWVudCA9IGVsZW1lbnRCeUlkKCdyZXNldCcpIGFzIEhUTUxFbGVtZW50O1xuY29uc3QgcmVzZXRCdG4gPSBlbGVtZW50QnlJZCgncmVzZXRCdG4nKSBhcyBIVE1MRWxlbWVudDtcbmNvbnN0IGxldmVsSW5mbyA9IGVsZW1lbnRCeUlkKCdsZXZlbEluZm8nKSBhcyBIVE1MRWxlbWVudDtcbmNvbnN0IG5vZGVJbmZvID0gZWxlbWVudEJ5SWQoJ25vZGVJbmZvJykgYXMgSFRNTEVsZW1lbnQ7XG5jb25zdCBkZXNjcmlwdGlvbkVsZW1lbnQgPSBlbGVtZW50QnlJZCgnZGVzY3JpcHRpb24nKSBhcyBIVE1MRWxlbWVudDtcblxuY29uc3Qgc2tpcEJ0biA9IGVsZW1lbnRCeUlkKCdza2lwQnRuJykgYXMgSFRNTEVsZW1lbnQ7XG5jb25zdCBiYWNrQnRuID0gZWxlbWVudEJ5SWQoJ2JhY2tCdG4nKSBhcyBIVE1MRWxlbWVudDtcblxuY29uc3Qgc2F2ZUxldmVsID0gKGxldmVsOiBudW1iZXIpID0+IHtcbiAgICB0cnkge1xuICAgICAgICBsb2NhbFN0b3JhZ2Uuc2V0SXRlbSgnbGV2ZWwnLCAnJyArIGxldmVsKTtcbiAgICB9IGNhdGNoIChlKSB7XG4gICAgICAgIC8vIElFIGFuZCBlZGdlIGRvbid0IHN1cHBvcnQgbG9jYWxzdG9yYWdlIHdoZW4gb3BlbmluZyB0aGUgZmlsZSBmcm9tIGRpc2tcbiAgICB9XG59O1xuXG5jb25zdCBsb2FkTGV2ZWwgPSAoKTogbnVtYmVyID0+IHtcbiAgICB0cnkge1xuICAgICAgICByZXR1cm4gcGFyc2VJbnQobG9jYWxTdG9yYWdlLmdldEl0ZW0oJ2xldmVsJykhKSB8fCAwO1xuICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgICAgcmV0dXJuIDA7XG4gICAgfVxufTtcblxuY29uc3QgcmVtb3ZlRWxlbWVudCA9IChlbGVtZW50OiBIVE1MRWxlbWVudCkgPT4ge1xuICAgIGVsZW1lbnQucGFyZW50Tm9kZSEucmVtb3ZlQ2hpbGQoZWxlbWVudCk7XG59O1xuXG5jb25zdCBmYWRlVGltZSA9IDAuNDtcblxuY29uc3Qgc2hvd0VsZW1lbnQgPSAoZWxlbWVudDogSFRNTEVsZW1lbnQgfCBIVE1MRWxlbWVudFtdLCBvbkNvbXBsZXRlPzogKCkgPT4gdm9pZCkgPT4ge1xuICAgIGxldCBlbGVtZW50cyA9IEFycmF5LmlzQXJyYXkoZWxlbWVudCkgPyBlbGVtZW50IDogW2VsZW1lbnRdO1xuICAgIGVsZW1lbnRzLmZvckVhY2goZSA9PiB7XG4gICAgICAgIGUuc3R5bGUudmlzaWJpbGl0eSA9ICd2aXNpYmxlJztcbiAgICAgICAgZS5zdHlsZS5vcGFjaXR5ID0gJzAnO1xuICAgIH0pO1xuICAgIHR3ZWVuKDAsIDEsIGZhZGVUaW1lLFxuICAgICAgICAodCkgPT4ge1xuICAgICAgICAgICAgZWxlbWVudHMuZm9yRWFjaChlID0+IHtcbiAgICAgICAgICAgICAgICBlLnN0eWxlLm9wYWNpdHkgPSB0LnRvU3RyaW5nKCk7XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfSxcbiAgICAgICAgKCkgPT4ge1xuICAgICAgICAgICAgb25Db21wbGV0ZSAmJiBvbkNvbXBsZXRlKCk7XG4gICAgICAgIH1cbiAgICApO1xufTtcblxuY29uc3QgaGlkZUVsZW1lbnQgPSAoZWxlbWVudDogSFRNTEVsZW1lbnQgfCBIVE1MRWxlbWVudFtdLCBvbkNvbXBsZXRlPzogKCkgPT4gdm9pZCkgPT4ge1xuICAgIGxldCBlbGVtZW50cyA9IEFycmF5LmlzQXJyYXkoZWxlbWVudCkgPyBlbGVtZW50IDogW2VsZW1lbnRdO1xuICAgIHR3ZWVuKDEsIDAsIGZhZGVUaW1lLFxuICAgICAgICAodCkgPT4ge1xuICAgICAgICAgICAgZWxlbWVudHMuZm9yRWFjaChlID0+IHtcbiAgICAgICAgICAgICAgICBlLnN0eWxlLm9wYWNpdHkgPSB0LnRvU3RyaW5nKCk7XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfSxcbiAgICAgICAgKCkgPT4ge1xuICAgICAgICAgICAgZWxlbWVudHMuZm9yRWFjaChlID0+IHtcbiAgICAgICAgICAgICAgICBlLnN0eWxlLnZpc2liaWxpdHkgPSAnaGlkZGVuJztcbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgb25Db21wbGV0ZSAmJiBvbkNvbXBsZXRlKCk7XG4gICAgICAgIH1cbiAgICApO1xufTtcbiIsIi8vIHR5cGUgTW91c2UgPSB7IHBvczogVmVjMiwgbGVmdERvd246IGJvb2xlYW47IH1cbi8vIHR5cGUgSW5wdXRDYWxsYmFjayA9ICgoKSA9PiB2b2lkKSB8IHVuZGVmaW5lZDtcbi8vIHR5cGUgSW5wdXRDYWxsYmFja3MgPSB7XG4vLyAgICAgbW91c2VPdmVyPzogSW5wdXRDYWxsYmFjaztcbi8vICAgICBtb3VzZU91dD86IElucHV0Q2FsbGJhY2s7XG4vLyAgICAgbW91c2VEb3duPzogSW5wdXRDYWxsYmFjaztcbi8vICAgICBtb3VzZVVwPzogSW5wdXRDYWxsYmFjaztcbi8vICAgICBtb3VzZURvd25VcGRhdGU/OiBJbnB1dENhbGxiYWNrO1xuLy8gfVxuXG4vLyBpbnRlcmZhY2UgSW5wdXRDb250cm9sIHtcbi8vICAgICBtb3VzZVBvczogVmVjMjtcbi8vICAgICBpc01vdXNlRG93bjogKCk9PmJvb2xlYW47XG5cbi8vICAgICB0YXJnZXRzOiBbTW91c2VEcmFnRW50aXR5LCBJbnB1dENhbGxiYWNrc11bXTtcblxuLy8gICAgIHNodXRkb3duKCk6IHZvaWQ7XG5cbi8vICAgICB1cGRhdGUoKTogdm9pZDtcblxuLy8gICAgIGRyYWdDb250cm9sKHRhcmdldDogTW91c2VEcmFnRW50aXR5LCBjYWxsYmFja3M6IElucHV0Q2FsbGJhY2tzKTogdm9pZDtcbi8vIH1cblxuLy8gY29uc3QgY3JlYXRlSW5wdXRDb250cm9sID0gKGNhbnZhczogQ2FudmFzKTogSW5wdXRDb250cm9sID0+IHtcbi8vICAgICBsZXQgbW91c2VEb3duOiBib29sZWFuID0gZmFsc2U7XG4vLyAgICAgY29uc3QgbW91c2VQb3M6IFZlYzIgPSB7eDogMSwgeTogMX07XG5cbi8vICAgICBjb25zdCBtb3VzZU92ZXJUYXJnZXRzOiBbTW91c2VEcmFnRW50aXR5LCBJbnB1dENhbGxiYWNrc11bXSA9IFtdO1xuLy8gICAgIGNvbnN0IG1vdXNlT3V0VGFyZ2V0czogW01vdXNlRHJhZ0VudGl0eSwgSW5wdXRDYWxsYmFja3NdW10gPSBbXTtcbi8vICAgICBjb25zdCBtb3VzZURvd25UYXJnZXRzOiBbTW91c2VEcmFnRW50aXR5LCBJbnB1dENhbGxiYWNrc11bXSA9IFtdO1xuXG4vLyAgICAgY29uc3QgbW91c2VNb3ZlTGlzdGVuZXIgPSAoZTogTW91c2VFdmVudCkgPT4ge1xuLy8gICAgICAgICBsZXQgcmVjdCA9IGNhbnZhcy5nZXRCb3VuZGluZ0NsaWVudFJlY3QoKTtcbi8vICAgICAgICAgbW91c2VQb3MueCA9IGUuY2xpZW50WCAtIHJlY3QubGVmdDtcbi8vICAgICAgICAgbW91c2VQb3MueSA9IGUuY2xpZW50WSAtIHJlY3QudG9wO1xuLy8gICAgICAgICBlLnByZXZlbnREZWZhdWx0KCk7XG4vLyAgICAgfTtcbi8vICAgICBjb25zdCBtb3VzZURvd25MaXN0ZW5lciA9IChlOiBNb3VzZUV2ZW50KSA9PiB7XG4vLyAgICAgICAgIG1vdXNlRG93biA9IHRydWU7XG4vLyAgICAgICAgIG1vdXNlT3ZlclRhcmdldHMuZm9yRWFjaCh3YXRjaCA9PiB7XG4vLyAgICAgICAgICAgICBjb25zdCBtb3VzZURvd25DYWxsYmFjayA9IHdhdGNoWzFdLm1vdXNlRG93bjtcbi8vICAgICAgICAgICAgIG1vdXNlRG93bkNhbGxiYWNrICYmIG1vdXNlRG93bkNhbGxiYWNrKCk7XG4vLyAgICAgICAgICAgICBtb3VzZURvd25UYXJnZXRzLnB1c2god2F0Y2gpO1xuLy8gICAgICAgICB9KTtcbi8vICAgICAgICAgZS5wcmV2ZW50RGVmYXVsdCgpO1xuLy8gICAgIH07XG4vLyAgICAgY29uc3QgbW91c2VVcExpc3RlbmVyID0gKGU6IE1vdXNlRXZlbnQpID0+IHtcbi8vICAgICAgICAgbW91c2VEb3duID0gZmFsc2U7XG4vLyAgICAgICAgIG1vdXNlRG93blRhcmdldHMuZm9yRWFjaCh3YXRjaCA9PiB7XG4vLyAgICAgICAgICAgICBjb25zdCBtb3VzZVVwQ2FsbGJhY2sgPSB3YXRjaFsxXS5tb3VzZVVwO1xuLy8gICAgICAgICAgICAgbW91c2VVcENhbGxiYWNrICYmIG1vdXNlVXBDYWxsYmFjaygpO1xuLy8gICAgICAgICB9KTtcbi8vICAgICAgICAgbW91c2VEb3duVGFyZ2V0cy5sZW5ndGggPSAwO1xuLy8gICAgIH07XG5cbi8vICAgICBkb2N1bWVudC5hZGRFdmVudExpc3RlbmVyKCdwb2ludGVybW92ZScsIG1vdXNlTW92ZUxpc3RlbmVyKTtcbi8vICAgICBkb2N1bWVudC5hZGRFdmVudExpc3RlbmVyKCdwb2ludGVyZG93bicsIG1vdXNlRG93bkxpc3RlbmVyKTtcbi8vICAgICBkb2N1bWVudC5hZGRFdmVudExpc3RlbmVyKCdwb2ludGVydXAnLCBtb3VzZVVwTGlzdGVuZXIpO1xuXG4vLyAgICAgY29uc3QgZHJhZ0NvbnRyb2wgPSAodGFyZ2V0OiBNb3VzZURyYWdFbnRpdHksIGNhbGxiYWNrczogSW5wdXRDYWxsYmFja3MpID0+IHtcbi8vICAgICAgICAgbW91c2VPdXRUYXJnZXRzLnB1c2goW3RhcmdldCwgY2FsbGJhY2tzXSk7XG4vLyAgICAgfTtcblxuLy8gICAgIGNvbnN0IHVwZGF0ZSA9ICgpID0+IHtcbi8vICAgICAgICAgZm9yIChsZXQgaSA9IG1vdXNlT3V0VGFyZ2V0cy5sZW5ndGggLSAxOyBpID49IDA7IC0taSkge1xuLy8gICAgICAgICAgICAgY29uc3Qgd2F0Y2ggPSBtb3VzZU91dFRhcmdldHNbaV07XG4vLyAgICAgICAgICAgICBjb25zdCBjYWxsYmFja3MgPSB3YXRjaFsxXTtcbi8vICAgICAgICAgICAgIGlmIChkaXN0Vihtb3VzZVBvcywgd2F0Y2hbMF0ucG9zKSA8PSB3YXRjaFswXS5tb3VzZURyYWcuc2l6ZSkge1xuLy8gICAgICAgICAgICAgICAgIGNhbGxiYWNrcy5tb3VzZU92ZXIgJiYgY2FsbGJhY2tzLm1vdXNlT3ZlcigpO1xuLy8gICAgICAgICAgICAgICAgIG1vdXNlT3V0VGFyZ2V0cy5zcGxpY2UoaSwgMSk7XG4vLyAgICAgICAgICAgICAgICAgbW91c2VPdmVyVGFyZ2V0cy5wdXNoKHdhdGNoKTtcbi8vICAgICAgICAgICAgIH1cbi8vICAgICAgICAgfVxuLy8gICAgICAgICBmb3IgKGxldCBpID0gbW91c2VPdmVyVGFyZ2V0cy5sZW5ndGggLSAxOyBpID49IDA7IC0taSkge1xuLy8gICAgICAgICAgICAgY29uc3Qgd2F0Y2ggPSBtb3VzZU92ZXJUYXJnZXRzW2ldO1xuLy8gICAgICAgICAgICAgY29uc3QgY2FsbGJhY2tzID0gd2F0Y2hbMV07XG5cbi8vICAgICAgICAgICAgIG1vdXNlRG93biAmJiBjYWxsYmFja3MubW91c2VEb3duVXBkYXRlICYmIGNhbGxiYWNrcy5tb3VzZURvd25VcGRhdGUoKTtcbi8vICAgICAgICAgICAgIGlmIChkaXN0Vihtb3VzZVBvcywgd2F0Y2hbMF0ucG9zKSA+IHdhdGNoWzBdLm1vdXNlRHJhZy5zaXplKSB7XG4vLyAgICAgICAgICAgICAgICAgY2FsbGJhY2tzLm1vdXNlT3V0ICYmIGNhbGxiYWNrcy5tb3VzZU91dCgpO1xuLy8gICAgICAgICAgICAgICAgIG1vdXNlT3ZlclRhcmdldHMuc3BsaWNlKGksIDEpO1xuLy8gICAgICAgICAgICAgICAgIG1vdXNlT3V0VGFyZ2V0cy5wdXNoKHdhdGNoKTtcbi8vICAgICAgICAgICAgIH1cbi8vICAgICAgICAgfVxuLy8gICAgIH07XG4vLyAgICAgY29uc3Qgc2h1dGRvd24gPSAoKSA9PiB7XG4vLyAgICAgICAgIGRvY3VtZW50LnJlbW92ZUV2ZW50TGlzdGVuZXIoJ3BvaW50ZXJtb3ZlJywgbW91c2VNb3ZlTGlzdGVuZXIpO1xuLy8gICAgICAgICBkb2N1bWVudC5yZW1vdmVFdmVudExpc3RlbmVyKCdwb2ludGVyZG93bicsIG1vdXNlRG93bkxpc3RlbmVyKTtcbi8vICAgICAgICAgZG9jdW1lbnQucmVtb3ZlRXZlbnRMaXN0ZW5lcigncG9pbnRlcnVwJywgbW91c2VVcExpc3RlbmVyKTtcbi8vICAgICB9O1xuXG4vLyAgICAgcmV0dXJuIHtcbi8vICAgICAgICAgdXBkYXRlLFxuLy8gICAgICAgICBkcmFnQ29udHJvbCxcbi8vICAgICAgICAgbW91c2VQb3MsXG4vLyAgICAgICAgIGlzTW91c2VEb3duOiAoKSA9PiAobW91c2VEb3duKSxcbi8vICAgICAgICAgc2h1dGRvd24sXG4vLyAgICAgICAgIHRhcmdldHM6bW91c2VPdmVyVGFyZ2V0c1xuLy8gICAgIH07XG4vLyB9O1xuXG5cblxuY29uc3QgY3JlYXRlSW5wdXRDb250cm9sID0gKGNhbnZhczogSFRNTENhbnZhc0VsZW1lbnQpOiBJbnB1dENvbnRyb2wgPT4ge1xuICAgIGxldCBtb3VzZURvd246IGJvb2xlYW4gPSBmYWxzZTtcbiAgICBjb25zdCBtb3VzZVBvczogVmVjMiA9IHsgeDogMSwgeTogMSB9O1xuICBcbiAgICBjb25zdCBtb3VzZU92ZXJUYXJnZXRzOiBbTW91c2VEcmFnRW50aXR5LCBJbnB1dENhbGxiYWNrc11bXSA9IFtdO1xuICAgIGNvbnN0IG1vdXNlT3V0VGFyZ2V0czogW01vdXNlRHJhZ0VudGl0eSwgSW5wdXRDYWxsYmFja3NdW10gPSBbXTtcbiAgICBjb25zdCBtb3VzZURvd25UYXJnZXRzOiBbTW91c2VEcmFnRW50aXR5LCBJbnB1dENhbGxiYWNrc11bXSA9IFtdO1xuICBcbiAgICBjb25zdCBtb3VzZU1vdmVMaXN0ZW5lciA9IChlOiBNb3VzZUV2ZW50KSA9PiB7XG4gICAgICBsZXQgcmVjdCA9IGNhbnZhcy5nZXRCb3VuZGluZ0NsaWVudFJlY3QoKTtcbiAgICAgIG1vdXNlUG9zLnggPSBlLmNsaWVudFggLSByZWN0LmxlZnQ7XG4gICAgICBtb3VzZVBvcy55ID0gZS5jbGllbnRZIC0gcmVjdC50b3A7XG4gICAgICBlLnByZXZlbnREZWZhdWx0KCk7XG4gICAgfTtcbiAgXG4gICAgY29uc3QgbW91c2VEb3duTGlzdGVuZXIgPSAoZTogTW91c2VFdmVudCkgPT4ge1xuICAgICAgbW91c2VEb3duID0gdHJ1ZTtcbiAgICAgIG1vdXNlT3ZlclRhcmdldHMuZm9yRWFjaCgod2F0Y2gpID0+IHtcbiAgICAgICAgY29uc3QgbW91c2VEb3duQ2FsbGJhY2sgPSB3YXRjaFsxXS5tb3VzZURvd247XG4gICAgICAgIG1vdXNlRG93bkNhbGxiYWNrICYmIG1vdXNlRG93bkNhbGxiYWNrKCk7XG4gICAgICAgIG1vdXNlRG93blRhcmdldHMucHVzaCh3YXRjaCk7XG4gICAgICB9KTtcbiAgICAgIGUucHJldmVudERlZmF1bHQoKTtcbiAgICB9O1xuICBcbiAgICBjb25zdCBtb3VzZVVwTGlzdGVuZXIgPSAoZTogTW91c2VFdmVudCkgPT4ge1xuICAgICAgbW91c2VEb3duID0gZmFsc2U7XG4gICAgICBtb3VzZURvd25UYXJnZXRzLmZvckVhY2goKHdhdGNoKSA9PiB7XG4gICAgICAgIGNvbnN0IG1vdXNlVXBDYWxsYmFjayA9IHdhdGNoWzFdLm1vdXNlVXA7XG4gICAgICAgIG1vdXNlVXBDYWxsYmFjayAmJiBtb3VzZVVwQ2FsbGJhY2soKTtcbiAgICAgIH0pO1xuICAgICAgbW91c2VEb3duVGFyZ2V0cy5sZW5ndGggPSAwO1xuICAgIH07XG4gIFxuICAgIGNvbnN0IHRvdWNoTW92ZUxpc3RlbmVyID0gKGU6IFRvdWNoRXZlbnQpID0+IHtcbiAgICAgIGlmIChlLnRvdWNoZXMubGVuZ3RoID4gMCkge1xuICAgICAgICBsZXQgcmVjdCA9IGNhbnZhcy5nZXRCb3VuZGluZ0NsaWVudFJlY3QoKTtcbiAgICAgICAgbW91c2VQb3MueCA9IGUudG91Y2hlc1swXS5jbGllbnRYIC0gcmVjdC5sZWZ0O1xuICAgICAgICBtb3VzZVBvcy55ID0gZS50b3VjaGVzWzBdLmNsaWVudFkgLSByZWN0LnRvcDtcbiAgICAgICAgZS5wcmV2ZW50RGVmYXVsdCgpO1xuICAgICAgfVxuICAgIH07XG4gIFxuICAgIGNvbnN0IHRvdWNoU3RhcnRMaXN0ZW5lciA9IChlOiBUb3VjaEV2ZW50KSA9PiB7XG4gICAgICBpZiAoZS50b3VjaGVzLmxlbmd0aCA+PSAwKSB7XG4gICAgICAgIG1vdXNlRG93biA9IHRydWU7XG4gICAgICAgIG1vdXNlT3ZlclRhcmdldHMuZm9yRWFjaCgod2F0Y2gpID0+IHtcbiAgICAgICAgICBjb25zdCBtb3VzZURvd25DYWxsYmFjayA9IHdhdGNoWzFdLm1vdXNlRG93bjtcbiAgICAgICAgICBtb3VzZURvd25DYWxsYmFjayAmJiBtb3VzZURvd25DYWxsYmFjaygpO1xuICAgICAgICAgIG1vdXNlRG93blRhcmdldHMucHVzaCh3YXRjaCk7XG4gICAgICAgIH0pO1xuICAgICAgICBlLnByZXZlbnREZWZhdWx0KCk7XG4gICAgICB9XG4gICAgfTtcbiAgXG4gICAgY29uc3QgdG91Y2hFbmRMaXN0ZW5lciA9IChlOiBUb3VjaEV2ZW50KSA9PiB7XG4gICAgICBtb3VzZURvd24gPSBmYWxzZTtcbiAgICAgIG1vdXNlRG93blRhcmdldHMuZm9yRWFjaCgod2F0Y2gpID0+IHtcbiAgICAgICAgY29uc3QgbW91c2VVcENhbGxiYWNrID0gd2F0Y2hbMV0ubW91c2VVcDtcbiAgICAgICAgbW91c2VVcENhbGxiYWNrICYmIG1vdXNlVXBDYWxsYmFjaygpO1xuICAgICAgfSk7XG4gICAgICBtb3VzZURvd25UYXJnZXRzLmxlbmd0aCA9IDA7XG4gICAgfTtcbiAgXG4gICAgZG9jdW1lbnQuYWRkRXZlbnRMaXN0ZW5lcignbW91c2Vtb3ZlJywgbW91c2VNb3ZlTGlzdGVuZXIpO1xuICAgIGRvY3VtZW50LmFkZEV2ZW50TGlzdGVuZXIoJ21vdXNlZG93bicsIG1vdXNlRG93bkxpc3RlbmVyKTtcbiAgICBkb2N1bWVudC5hZGRFdmVudExpc3RlbmVyKCdtb3VzZXVwJywgbW91c2VVcExpc3RlbmVyKTtcbiAgXG4gICAgLy8gQWRkIHRvdWNoIGV2ZW50IGxpc3RlbmVyc1xuICAgIGRvY3VtZW50LmFkZEV2ZW50TGlzdGVuZXIoJ3RvdWNobW92ZScsIHRvdWNoTW92ZUxpc3RlbmVyKTtcbiAgICBkb2N1bWVudC5hZGRFdmVudExpc3RlbmVyKCd0b3VjaHN0YXJ0JywgdG91Y2hTdGFydExpc3RlbmVyKTtcbiAgICBkb2N1bWVudC5hZGRFdmVudExpc3RlbmVyKCd0b3VjaGVuZCcsIHRvdWNoRW5kTGlzdGVuZXIpO1xuICBcbiAgICBjb25zdCBkcmFnQ29udHJvbCA9ICh0YXJnZXQ6IE1vdXNlRHJhZ0VudGl0eSwgY2FsbGJhY2tzOiBJbnB1dENhbGxiYWNrcykgPT4ge1xuICAgICAgbW91c2VPdXRUYXJnZXRzLnB1c2goW3RhcmdldCwgY2FsbGJhY2tzXSk7XG4gICAgfTtcbiAgXG4gICAgY29uc3QgdXBkYXRlID0gKCkgPT4ge1xuICAgICAgZm9yIChsZXQgaSA9IG1vdXNlT3V0VGFyZ2V0cy5sZW5ndGggLSAxOyBpID49IDA7IC0taSkge1xuICAgICAgICBjb25zdCB3YXRjaCA9IG1vdXNlT3V0VGFyZ2V0c1tpXTtcbiAgICAgICAgY29uc3QgY2FsbGJhY2tzID0gd2F0Y2hbMV07XG4gICAgICAgIGlmIChkaXN0Vihtb3VzZVBvcywgd2F0Y2hbMF0ucG9zKSA8PSB3YXRjaFswXS5tb3VzZURyYWcuc2l6ZSkge1xuICAgICAgICAgIGNhbGxiYWNrcy5tb3VzZU92ZXIgJiYgY2FsbGJhY2tzLm1vdXNlT3ZlcigpO1xuICAgICAgICAgIG1vdXNlT3V0VGFyZ2V0cy5zcGxpY2UoaSwgMSk7XG4gICAgICAgICAgbW91c2VPdmVyVGFyZ2V0cy5wdXNoKHdhdGNoKTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgZm9yIChsZXQgaSA9IG1vdXNlT3ZlclRhcmdldHMubGVuZ3RoIC0xOyBpID49IDA7IC0taSkge1xuICAgICAgICBjb25zdCB3YXRjaCA9IG1vdXNlT3ZlclRhcmdldHNbaV07XG4gICAgICAgIGNvbnN0IGNhbGxiYWNrcyA9IHdhdGNoWzFdO1xuICBcbiAgICAgICAgbW91c2VEb3duICYmIGNhbGxiYWNrcy5tb3VzZURvd25VcGRhdGUgJiYgY2FsbGJhY2tzLm1vdXNlRG93blVwZGF0ZSgpO1xuICAgICAgICBpZiAoZGlzdFYobW91c2VQb3MsIHdhdGNoWzBdLnBvcykgPiB3YXRjaFswXS5tb3VzZURyYWcuc2l6ZSkge1xuICAgICAgICAgIGNhbGxiYWNrcy5tb3VzZU91dCAmJiBjYWxsYmFja3MubW91c2VPdXQoKTtcbiAgICAgICAgICBtb3VzZU92ZXJUYXJnZXRzLnNwbGljZShpLCAxKTtcbiAgICAgICAgICBtb3VzZU91dFRhcmdldHMucHVzaCh3YXRjaCk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9O1xuICBcbiAgICBjb25zdCBzaHV0ZG93biA9ICgpID0+IHtcbiAgICAgIGRvY3VtZW50LnJlbW92ZUV2ZW50TGlzdGVuZXIoJ21vdXNlbW92ZScsIG1vdXNlTW92ZUxpc3RlbmVyKTtcbiAgICAgIGRvY3VtZW50LnJlbW92ZUV2ZW50TGlzdGVuZXIoJ21vdXNlZG93bicsIG1vdXNlRG93bkxpc3RlbmVyKTtcbiAgICAgIGRvY3VtZW50LnJlbW92ZUV2ZW50TGlzdGVuZXIoJ21vdXNldXAnLCBtb3VzZVVwTGlzdGVuZXIpO1xuICBcbiAgICAgIC8vIFJlbW92ZSB0b3VjaCBldmVudCBsaXN0ZW5lcnNcbiAgICAgIGRvY3VtZW50LnJlbW92ZUV2ZW50TGlzdGVuZXIoJ3RvdWNobW92ZScsIHRvdWNoTW92ZUxpc3RlbmVyKTtcbiAgICAgIGRvY3VtZW50LnJlbW92ZUV2ZW50TGlzdGVuZXIoJ3RvdWNoc3RhcnQnLCB0b3VjaFN0YXJ0TGlzdGVuZXIpO1xuICAgICAgZG9jdW1lbnQucmVtb3ZlRXZlbnRMaXN0ZW5lcigndG91Y2hlbmQnLCB0b3VjaEVuZExpc3RlbmVyKTtcbiAgICB9O1xuICBcbiAgICByZXR1cm4ge1xuICAgICAgdXBkYXRlLFxuICAgICAgZHJhZ0NvbnRyb2wsXG4gICAgICBtb3VzZVBvcyxcbiAgICAgIGlzTW91c2VEb3duOiAoKSA9PiBtb3VzZURvd24sXG4gICAgICBzaHV0ZG93bixcbiAgICAgIHRhcmdldHM6IG1vdXNlT3ZlclRhcmdldHMsXG4gICAgfTtcbiAgfTtcbiAgIiwiY29uc3QgY3JlYXRlTGV2ZWxFZGl0b3JTeXN0ZW0gPSAoc3BhY2U6IFNwYWNlLCBpbnB1dENvbnRyb2w6IElucHV0Q29udHJvbCk6IFVwZGF0ZVN5c3RlbSA9PiB7XG4gICAgY29uc3QgbW91c2VXaGVlbExpc3RlbmVyID0gKGU6IFdoZWVsRXZlbnQpID0+IHtcbiAgICAgICAgZS5wcmV2ZW50RGVmYXVsdCgpO1xuICAgICAgICBjb25zdCBzcG9vbCA9IChpbnB1dENvbnRyb2wudGFyZ2V0c1swXVswXSBhcyBFbnRpdHkpLnNwb29sIHx8IChpbnB1dENvbnRyb2wudGFyZ2V0c1swXVswXSBhcyBFbnRpdHkpLmJsb2NrO1xuXG4gICAgICAgIGlmICghc3Bvb2wpIHtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuICAgICAgICBsZXQgbWluID0gMzA7XG4gICAgICAgIGxldCBtYXggPSAxNjA7XG4gICAgICAgIGlmIChzcG9vbC50eXBlID09IE5vZGVUeXBlLmlzb2xhdG9yKSB7XG4gICAgICAgICAgICBtYXggPSA4MDtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChlLmRlbHRhWSA8IDApIHtcbiAgICAgICAgICAgIHNwb29sLnNpemUgIT09IG1heCAmJiAoc3Bvb2wuc2l6ZSArPSAxMCk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBzcG9vbC5zaXplICE9PSBtaW4gJiYgKHNwb29sLnNpemUgLT0gMTApO1xuICAgICAgICB9XG4gICAgfTtcblxuICAgIGNvbnN0IGtleWRvd25MaXN0ZW5lciA9IChlOiBLZXlib2FyZEV2ZW50KSA9PiB7XG4gICAgICAgIGlmIChlLmtleSA9PT0gJzEnKSB7XG4gICAgICAgICAgICBjb25zdCBzcG9vbEVudGl0eTogU3Bvb2xOb2RlRW50aXR5ID0ge1xuICAgICAgICAgICAgICAgIHBvczoge3g6IGlucHV0Q29udHJvbC5tb3VzZVBvcy54IC0gMSwgeTogaW5wdXRDb250cm9sLm1vdXNlUG9zLnl9LFxuICAgICAgICAgICAgICAgIHNwb29sOiB7c2l6ZTogNTAsIHR5cGU6IE5vZGVUeXBlLnNwb29sfSxcbiAgICAgICAgICAgICAgICByZW5kZXI6IHt0eXBlOiBOb2RlVHlwZS5zcG9vbH0sXG4gICAgICAgICAgICB9O1xuICAgICAgICAgICAgLy8gKHNwb29sRW50aXR5IGFzIGFueSkubW91c2VEcmFnID0ge3NpemU6IDIwfTtcbiAgICAgICAgICAgIHNwYWNlLmFkZEVudGl0eShzcG9vbEVudGl0eSk7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKGUua2V5ID09PSAnMicpIHtcbiAgICAgICAgICAgIGNvbnN0IHNwb29sRW50aXR5OiBCbG9ja05vZGVFbnRpdHkgPSB7XG4gICAgICAgICAgICAgICAgcG9zOiB7eDogaW5wdXRDb250cm9sLm1vdXNlUG9zLngsIHk6IGlucHV0Q29udHJvbC5tb3VzZVBvcy55fSxcbiAgICAgICAgICAgICAgICBibG9jazoge3NpemU6IDUwfSxcbiAgICAgICAgICAgICAgICByZW5kZXI6IHt0eXBlOiBOb2RlVHlwZS5ibG9ja30sXG4gICAgICAgICAgICB9O1xuICAgICAgICAgICAgLy8gKHNwb29sRW50aXR5IGFzIGFueSkubW91c2VEcmFnID0ge3NpemU6IDIwfTtcbiAgICAgICAgICAgIHNwYWNlLmFkZEVudGl0eShzcG9vbEVudGl0eSk7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKGUua2V5ID09PSAnMycpIHtcbiAgICAgICAgICAgIGNvbnN0IHNwb29sRW50aXR5OiBTcG9vbE5vZGVFbnRpdHkgPSB7XG4gICAgICAgICAgICAgICAgcG9zOiB7eDogaW5wdXRDb250cm9sLm1vdXNlUG9zLngsIHk6IGlucHV0Q29udHJvbC5tb3VzZVBvcy55fSxcbiAgICAgICAgICAgICAgICBzcG9vbDoge3NpemU6IDQwLCB0eXBlOiBOb2RlVHlwZS5pc29sYXRvcn0sXG4gICAgICAgICAgICAgICAgcmVuZGVyOiB7dHlwZTogTm9kZVR5cGUuaXNvbGF0b3J9LFxuICAgICAgICAgICAgfTtcbiAgICAgICAgICAgIC8vIChzcG9vbEVudGl0eSBhcyBhbnkpLm1vdXNlRHJhZyA9IHtzaXplOiAyMH07XG4gICAgICAgICAgICBzcGFjZS5hZGRFbnRpdHkoc3Bvb2xFbnRpdHkpO1xuICAgICAgICB9XG4gICAgICAgIGlmIChlLmtleSA9PT0gJ0YyJykge1xuICAgICAgICAgICAgY29uc3QgbGV2ZWw6IFBhcnRpYWw8TGV2ZWxEYXRhPiA9IHtzcG9vbHM6IFtdLCBpc29sYXRvcnM6IFtdLCBibG9ja3M6IFtdfTtcbiAgICAgICAgICAgIHNwYWNlLmVudGl0aWVzLmZvckVhY2goZW50aXR5ID0+IHtcbiAgICAgICAgICAgICAgICBpZiAoZW50aXR5LnNwb29sKSB7XG4gICAgICAgICAgICAgICAgICAgIHN3aXRjaCAoZW50aXR5LnNwb29sLnR5cGUpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNhc2UgTm9kZVR5cGUuc3Bvb2w6XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgbGV2ZWwuc3Bvb2xzIS5wdXNoKFtlbnRpdHkucG9zIS54LCBlbnRpdHkucG9zIS55LCBlbnRpdHkuc3Bvb2wuc2l6ZV0pO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICAgICAgICAgICAgY2FzZSBOb2RlVHlwZS5zdGFydDpcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBsZXZlbC5zdGFydCA9IFtlbnRpdHkucG9zIS54LCBlbnRpdHkucG9zIS55XTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgICAgICAgICAgIGNhc2UgTm9kZVR5cGUuZW5kOlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGxldmVsLmVuZCA9IFsxMTAsIDM2MF07XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgICAgICAgICAgICBjYXNlIE5vZGVUeXBlLmlzb2xhdG9yOlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGxldmVsLmlzb2xhdG9ycyEucHVzaChbZW50aXR5LnBvcyEueCwgZW50aXR5LnBvcyEueSwgZW50aXR5LnNwb29sIS5zaXplXSk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgaWYgKGVudGl0eS5maW5pc2gpIHtcbiAgICAgICAgICAgICAgICAgICAgbGV2ZWwuZmluaXNoID0gW2VudGl0eS5wb3MhLngsIGVudGl0eS5wb3MhLnldO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBpZiAoZW50aXR5LmJsb2NrKSB7XG4gICAgICAgICAgICAgICAgICAgIGxldmVsLmJsb2NrcyEucHVzaChbZW50aXR5LnBvcyEueCwgZW50aXR5LnBvcyEueSwgZW50aXR5LmJsb2NrLnNpemVdKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9KTtcblxuICAgICAgICAgICAgY29uc29sZS5sb2coSlNPTi5zdHJpbmdpZnkobGV2ZWwpKTtcbiAgICAgICAgfVxuICAgIH07XG5cbiAgICB3aW5kb3cuYWRkRXZlbnRMaXN0ZW5lcigna2V5ZG93bicsIGtleWRvd25MaXN0ZW5lcik7XG4gICAgd2luZG93LmFkZEV2ZW50TGlzdGVuZXIoJ3doZWVsJywgbW91c2VXaGVlbExpc3RlbmVyKTtcblxuICAgIHJldHVybiB7XG4gICAgICAgIGFkZEVudGl0eTogZW50aXR5ID0+IHtcbiAgICAgICAgICAgIGlmIChlbnRpdHkuc3Bvb2wpIHtcbiAgICAgICAgICAgICAgICBpZiAoZW50aXR5LnNwb29sLnR5cGUgIT0gTm9kZVR5cGUuZW5kKSB7XG4gICAgICAgICAgICAgICAgICAgIGVudGl0eS5tb3VzZURyYWcgPSB7c2l6ZTogZW50aXR5LnNwb29sLnNpemV9O1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaWYgKGVudGl0eS5ibG9jaykge1xuICAgICAgICAgICAgICAgIGVudGl0eS5tb3VzZURyYWcgPSB7c2l6ZTogZW50aXR5LmJsb2NrLnNpemV9O1xuICAgICAgICAgICAgfVxuICAgICAgICB9LFxuICAgICAgICB1cGRhdGU6ICh0aW1lOiBudW1iZXIpID0+IHtcbiAgICAgICAgfSxcbiAgICAgICAgc2h1dGRvd246ICgpID0+IHtcbiAgICAgICAgICAgIHdpbmRvdy5yZW1vdmVFdmVudExpc3RlbmVyKCdrZXlkb3duJywga2V5ZG93bkxpc3RlbmVyKTtcbiAgICAgICAgfVxuICAgIH07XG59O1xuIiwidHlwZSBMZXZlbERhdGEgPSB7XG4gICAgc3Bvb2xzOiBbbnVtYmVyLCBudW1iZXIsIG51bWJlcl1bXSxcbiAgICBibG9ja3M6IFtudW1iZXIsIG51bWJlciwgbnVtYmVyXVtdLFxuICAgIGlzb2xhdG9yczogW251bWJlciwgbnVtYmVyLCBudW1iZXJdW10sXG4gICAgc3RhcnQ6IFtudW1iZXIsIG51bWJlcl1cbiAgICBlbmQ6IFtudW1iZXIsIG51bWJlcl1cbiAgICBmaW5pc2g6IFtudW1iZXIsIG51bWJlcl1cbn1cbnR5cGUgR2FtZURhdGEgPSB7XG4gICAgbGV2ZWxzOiBMZXZlbERhdGFbXTtcbn1cblxuY29uc3QgZ2FtZURhdGE6IEdhbWVEYXRhID0ge1xuICAgIGxldmVsczogW1xuICAgICAgICAvLyB7ICBMRVZFTCBURU1QTEFURVxuICAgICAgICAvLyAgICAgJ3Nwb29scyc6IFtbODY0LCAzMzYsIDE1MF0sIFs1NjAsIDM3OCwgNTBdXSxcbiAgICAgICAgLy8gICAgICdpc29sYXRvcnMnOiBbXSxcbiAgICAgICAgLy8gICAgICdibG9ja3MnOiBbXSxcbiAgICAgICAgLy8gICAgICdzdGFydCc6IFs1MCwgMzYwXSxcbiAgICAgICAgLy8gICAgICdmaW5pc2gnOiBbMTIzMCwgMzYwXSxcbiAgICAgICAgLy8gICAgICdlbmQnOiBbMTEwLCAzNjBdXG4gICAgICAgIC8vIH1cbiAgICAgICAgLy8gMVxuICAgICAgICB7XG4gICAgICAgICAgICAnc3Bvb2xzJzogW1s0NjAsIDIwNywgNzBdLCBbNDY4LCA1MTYsIDcwXV0sXG4gICAgICAgICAgICAnaXNvbGF0b3JzJzogW10sXG4gICAgICAgICAgICAnYmxvY2tzJzogW10sXG4gICAgICAgICAgICAnc3RhcnQnOiBbNTAsIDM2MF0sXG4gICAgICAgICAgICAnZmluaXNoJzogWzEyMzAsIDM2MF0sXG4gICAgICAgICAgICAnZW5kJzogWzExMCwgMzYwXVxuICAgICAgICB9LC8vIDJcbiAgICAgICAge1xuICAgICAgICAgICAgJ3Nwb29scyc6IFtbNDQwLCA1NDAsIDYwXSwgWzg0NiwgNTU2LCA2MF0sIFs2NDUsIDE3MywgOTBdXSxcbiAgICAgICAgICAgICdpc29sYXRvcnMnOiBbXSxcbiAgICAgICAgICAgICdibG9ja3MnOiBbWzc3NywgMzY5LCAxMTBdLCBbMjQ5LCA0NjEsIDcwXV0sXG4gICAgICAgICAgICAnc3RhcnQnOiBbNTAsIDM2MF0sXG4gICAgICAgICAgICAnZmluaXNoJzogWzEyMzAsIDM2MF0sXG4gICAgICAgICAgICAnZW5kJzogWzExMCwgMzYwXVxuICAgICAgICB9LC8vIDNcbiAgICAgICAge1xuICAgICAgICAgICAgJ3Nwb29scyc6IFtbODcxLCA0NDcsIDUwXSwgWzY1OSwgNTkwLCA1MF0sIFs2MjksIDI2NywgNDBdXSxcbiAgICAgICAgICAgICdpc29sYXRvcnMnOiBbWzQzOCwgNTYxLCA0MF0sIFs0OTcsIDE0OCwgNDBdXSxcbiAgICAgICAgICAgICdibG9ja3MnOiBbWzI0MSwgNDM1LCA3MF0sIFs2NzUsIDQyMiwgOTBdLCBbMzI0LCAyMTUsIDUwXV0sXG4gICAgICAgICAgICAnc3RhcnQnOiBbNTAsIDM2MF0sXG4gICAgICAgICAgICAnZmluaXNoJzogWzEyMzAsIDM2MF0sXG4gICAgICAgICAgICAnZW5kJzogWzExMCwgMzYwXVxuICAgICAgICB9LC8vIDRcbiAgICAgICAge1xuICAgICAgICAgICAgJ3Nwb29scyc6IFtbODcyLCA0OTYsIDEzMF0sIFs1MDgsIDIzNCwgNjBdLCBbNTA4LCA0ODYsIDYwXSwgWzg3MSwgMTkwLCAxMzBdXSxcbiAgICAgICAgICAgICdpc29sYXRvcnMnOiBbWzIzNCwgNTI1LCA0MF0sIFsyMzcsIDE4MiwgNDBdXSxcbiAgICAgICAgICAgICdibG9ja3MnOiBbWzY2NywgMjg4LCA2MF0sIFs2NjksIDQyNywgNjBdLCBbNTkzLCAxMzIsIDYwXSwgWzU5NywgNTg4LCA2MF1dLFxuICAgICAgICAgICAgJ3N0YXJ0JzogWzUwLCAzNjBdLFxuICAgICAgICAgICAgJ2ZpbmlzaCc6IFsxMjMwLCAzNjBdLFxuICAgICAgICAgICAgJ2VuZCc6IFsxMTAsIDM2MF1cbiAgICAgICAgfSwvLyA1XG4gICAgICAgIHtcbiAgICAgICAgICAgICdzcG9vbHMnOiBbWzg0NSwgMTU2LCA3MF0sIFs1OTUsIDQ0MywgNjBdLCBbNjY4LCA2MDksIDYwXSwgWzM5NiwgNDE2LCA1MF1dLFxuICAgICAgICAgICAgJ2lzb2xhdG9ycyc6IFtbODMyLCAzOTYsIDQwXSwgWzU1NiwgMjQ3LCA0MF1dLFxuICAgICAgICAgICAgJ2Jsb2Nrcyc6IFtbNjk2LCAyMDQsIDYwXSwgWzcyMSwgMzkyLCA2MF0sIFs0OTgsIDM0NSwgNTBdXSxcbiAgICAgICAgICAgICdzdGFydCc6IFs1MCwgMzYwXSxcbiAgICAgICAgICAgICdmaW5pc2gnOiBbMTIzMCwgMzYwXSxcbiAgICAgICAgICAgICdlbmQnOiBbMTEwLCAzNjBdXG4gICAgICAgIH0sIC8vIDZcbiAgICAgICAge1xuICAgICAgICAgICAgJ3Nwb29scyc6IFtbNjY0LCAzMzgsIDcwXSwgWzM2NSwgMTcxLCA5MF0sIFs5MjksIDE3MCwgOTBdLCBbMTAxMSwgNTU5LCA4MF0sIFszNzIsIDU1OCwgOTBdXSxcbiAgICAgICAgICAgICdpc29sYXRvcnMnOiBbWzcyOSwgNTYxLCA0MF0sIFsxMTQ5LCAyNjYsIDQwXV0sXG4gICAgICAgICAgICAnYmxvY2tzJzogW1s3NTcsIDIwMywgNzBdLCBbODQ2LCAzNzUsIDcwXSwgWzU4NSwgNTQ5LCA4MF0sIFsxMTUwLCA0MjksIDUwXV0sXG4gICAgICAgICAgICAnc3RhcnQnOiBbNTAsIDM2MF0sXG4gICAgICAgICAgICAnZmluaXNoJzogWzEyMzAsIDM2MF0sXG4gICAgICAgICAgICAnZW5kJzogWzExMCwgMzYwXVxuICAgICAgICB9LCAvLyA3XG4gICAgICAgIHtcbiAgICAgICAgICAgICdzcG9vbHMnOiBbWzUwMiwgMjU5LCA2MF0sIFs1MDgsIDQ1OCwgNjBdLCBbOTc5LCAzNTYsIDUwXSwgWzM0NiwgNTczLCA2MF0sIFszMTksIDE0MSwgNjBdXSxcbiAgICAgICAgICAgICdpc29sYXRvcnMnOiBbWzcyNCwgMzYxLCA0MF0sIFs3MjAsIDE0MiwgNDBdXSxcbiAgICAgICAgICAgICdibG9ja3MnOiBbWzYwOSwgMzUzLCA2MF0sIFszNzksIDQ1MSwgNTBdLCBbODQ4LCAzNjAsIDcwXV0sXG4gICAgICAgICAgICAnc3RhcnQnOiBbNTAsIDM2MF0sXG4gICAgICAgICAgICAnZmluaXNoJzogWzEyMzAsIDM2MF0sXG4gICAgICAgICAgICAnZW5kJzogWzExMCwgMzYwXVxuICAgICAgICB9LCAvLyA4XG4gICAgICAgIHtcbiAgICAgICAgICAgICdzcG9vbHMnOiBbWzk1NywgMTU2LCA3MF0sIFszNzgsIDU3MCwgNzBdLCBbNTA3LCAxMDksIDYwXV0sXG4gICAgICAgICAgICAnaXNvbGF0b3JzJzogW1s1NjgsIDUzNiwgNDBdLCBbMzgyLCAxOTgsIDQwXSwgWzY1OSwgMTEyLCA0MF0sIFs5NDAsIDM0OCwgNDBdXSxcbiAgICAgICAgICAgICdibG9ja3MnOiBbWzc1NiwgNDQ1LCAxMDBdLCBbMTEyMiwgMjM0LCA1MF1dLFxuICAgICAgICAgICAgJ3N0YXJ0JzogWzUwLCAzNjBdLFxuICAgICAgICAgICAgJ2ZpbmlzaCc6IFsxMjMwLCAzNjBdLFxuICAgICAgICAgICAgJ2VuZCc6IFsxMTAsIDM2MF1cbiAgICAgICAgfSwgLy8gOVxuICAgICAgICB7XG4gICAgICAgICAgICAnc3Bvb2xzJzogW1s2MjksIDEzMCwgNDBdLCBbODExLCA0ODIsIDUwXSwgWzM4NSwgNDkxLCA1MF0sIFszODYsIDMxNywgNTBdLCBbOTc2LCA1NjksIDQwXSwgWzg0NCwgMTM5LCA2MF0sIFsxMTYxLCAxMzgsIDUwXV0sXG4gICAgICAgICAgICAnaXNvbGF0b3JzJzogW1syMjIsIDIzMCwgNDBdLCBbMjE2LCA1ODcsIDMwXV0sXG4gICAgICAgICAgICAnYmxvY2tzJzogW1s2MTksIDM2NywgMTYwXSwgWzEwMTUsIDI1NSwgMTMwXV0sXG4gICAgICAgICAgICAnc3RhcnQnOiBbNTAsIDM2MF0sXG4gICAgICAgICAgICAnZmluaXNoJzogWzEyMzAsIDM2MF0sXG4gICAgICAgICAgICAnZW5kJzogWzExMCwgMzYwXVxuICAgICAgICB9LCAvLyAxMFxuICAgICAgICB7XG4gICAgICAgICAgICAnc3Bvb2xzJzogW1s5MjIsIDUwOSwgMTUwXSwgWzI1NywgNTUyLCA2MF0sIFsyMDEsIDIwMCwgNTBdLCBbNTA5LCA1MTksIDUwXSwgWzUyMCwgMTM0LCA1MF0sIFs5MzcsIDI1NywgNTBdLCBbMTExMSwgMTMzLCA1MF1dLFxuICAgICAgICAgICAgJ2lzb2xhdG9ycyc6IFtbNjc4LCA0NjUsIDQwXSwgWzY3OSwgMjkxLCA0MF1dLFxuICAgICAgICAgICAgJ2Jsb2Nrcyc6IFtbODg3LCAxMTMsIDgwXSwgWzM5MiwgNDM4LCA3MF0sIFs2OTksIDU3MywgNTBdLCBbMTE2MywgNDY4LCA1MF1dLFxuICAgICAgICAgICAgJ3N0YXJ0JzogWzUwLCAzNjBdLFxuICAgICAgICAgICAgJ2ZpbmlzaCc6IFsxMjMwLCAzNjBdLFxuICAgICAgICAgICAgJ2VuZCc6IFsxMTAsIDM2MF1cbiAgICAgICAgfSwgLy8gMTFcbiAgICAgICAge1xuICAgICAgICAgICAgJ3Nwb29scyc6IFtbMjI4LCAxOTMsIDE1MF0sIFszMjYsIDU2MywgODBdLCBbNTU3LCAyMDksIDcwXSwgWzc4NSwgMTk5LCA1MF0sIFsxMDQzLCA1OTMsIDgwXSwgWzEwMTUsIDE4OCwgMTMwXSwgWzc5MSwgNTQ4LCA1MF0sIFs1NDMsIDU0NCwgNTBdLCBbNTExLCAzNzMsIDMwXSwgWzY4NSwgMzMzLCAzMF1dLFxuICAgICAgICAgICAgJ2lzb2xhdG9ycyc6IFtbNjg3LCA0NDYsIDMwXSwgWzEyMDUsIDQ1NSwgMzBdXSxcbiAgICAgICAgICAgICdibG9ja3MnOiBbWzQ0MiwgMTE2LCA1MF0sIFs5ODIsIDQwMCwgNTBdLCBbMTIwMywgMjY1LCA1MF0sIFsxMTg1LCA1NjMsIDUwXSwgWzc3NiwgMzgyLCA2MF0sIFs0MDgsIDQyOCwgNTBdXSxcbiAgICAgICAgICAgICdzdGFydCc6IFs1MCwgMzYwXSxcbiAgICAgICAgICAgICdmaW5pc2gnOiBbMTIzMCwgMzYwXSxcbiAgICAgICAgICAgICdlbmQnOiBbMTEwLCAzNjBdXG4gICAgICAgIH0sIC8vIDEyXG4gICAgICAgIHtcbiAgICAgICAgICAgICdzcG9vbHMnOiBbWzY2OSwgMzU1LCA4MF0sIFs2NjgsIDE4NywgNTBdLCBbNjY2LCA3MCwgMzBdLCBbNjY4LCA1MTQsIDUwXSwgWzY3MywgNjUzLCAzMF0sIFs0NzMsIDM2MSwgNTBdLCBbODUyLCAzNTMsIDUwXSwgWzk4NiwgMzQ4LCAzMF0sIFszMzUsIDM2MSwgMzBdXSxcbiAgICAgICAgICAgICdpc29sYXRvcnMnOiBbXSxcbiAgICAgICAgICAgICdibG9ja3MnOiBbWzgwNCwgNDc2LCA1MF0sIFs1NTIsIDI0NCwgNjBdLCBbODU3LCAxNzQsIDkwXSwgWzQ4OSwgNTQxLCA4MF1dLFxuICAgICAgICAgICAgJ3N0YXJ0JzogWzUwLCAzNjBdLFxuICAgICAgICAgICAgJ2ZpbmlzaCc6IFsxMjMwLCAzNjBdLFxuICAgICAgICAgICAgJ2VuZCc6IFsxMTAsIDM2MF1cbiAgICAgICAgfSwgLy8gMTNcbiAgICAgICAge1xuICAgICAgICAgICAgJ3Nwb29scyc6IFtbNTQ5LCAxMTQsIDYwXSwgWzIxMywgMzQ1LCAzMF0sIFszODksIDE4NiwgNTBdLCBbODM0LCA5MywgNzBdLCBbMjk3LCAyNzIsIDQwXSwgWzM4OSwgNTY0LCA1MF0sIFs2MDYsIDU0MiwgNTBdLCBbODE1LCA1NjYsIDUwXV0sXG4gICAgICAgICAgICAnaXNvbGF0b3JzJzogW10sXG4gICAgICAgICAgICAnYmxvY2tzJzogW1s4MzksIDMwMCwgMTMwXSwgWzEwNjIsIDM0MywgODBdLCBbNDgzLCAzNTQsIDUwXSwgWzMzNywgNDE5LCA3MF0sIFs0ODUsIDUzNywgMzBdLCBbMjA0LCA1MDcsIDUwXV0sXG4gICAgICAgICAgICAnc3RhcnQnOiBbNTAsIDM2MF0sXG4gICAgICAgICAgICAnZmluaXNoJzogWzEyMzAsIDM2MF0sXG4gICAgICAgICAgICAnZW5kJzogWzExMCwgMzYwXVxuICAgICAgICB9LCAvLyAxNFxuICAgICAgICB7XG4gICAgICAgICAgICAnc3Bvb2xzJzogW1s0MDIsIDM4MCwgOTBdLCBbNzU4LCAzNzksIDkwXSwgWzg5MCwgMTk1LCA1MF0sIFszMjQsIDE2NiwgNTBdLCBbMTAzNiwgOTEsIDQwXSwgWzEwMzgsIDQ2MSwgNTBdLCBbMTA1NSwgNjIyLCA0MF1dLFxuICAgICAgICAgICAgJ2lzb2xhdG9ycyc6IFtbNjAwLCAxMDAsIDQwXSwgWzU5NSwgNjE3LCA0MF1dLFxuICAgICAgICAgICAgJ2Jsb2Nrcyc6IFtbMTU5LCAyNTEsIDUwXSwgWzczMywgMTU2LCA3MF0sIFs4ODYsIDU1MywgODBdLCBbOTg4LCAzMDMsIDgwXSwgWzExNjcsIDIzOCwgNTBdLCBbMTA4MiwgNTM2LCAzMF1dLFxuICAgICAgICAgICAgJ3N0YXJ0JzogWzUwLCAzNjBdLFxuICAgICAgICAgICAgJ2ZpbmlzaCc6IFsxMjMwLCAzNjBdLFxuICAgICAgICAgICAgJ2VuZCc6IFsxMTAsIDM2MF1cbiAgICAgICAgfSwgLy8gMTVcbiAgICAgICAge1xuICAgICAgICAgICAgJ3Nwb29scyc6IFtbNjQ3LCAzNjAsIDE2MF0sIFszMjYsIDIzMywgMzBdLCBbNDYyLCAxMTEsIDMwXSwgWzY0NiwgNzEsIDMwXSwgWzgxOSwgMTIwLCAzMF0sIFs5MzIsIDI3NywgMzBdLCBbOTMwLCA0NjgsIDMwXSwgWzgwOSwgNjAyLCAzMF0sIFs2MjYsIDY0NCwgMzBdLCBbNDM4LCA1NzksIDMwXSwgWzMzNCwgNDA0LCAzMF1dLFxuICAgICAgICAgICAgJ2lzb2xhdG9ycyc6IFtbMTg4LCAxMTksIDMwXSwgWzE5MiwgNTY4LCAzMF1dLFxuICAgICAgICAgICAgJ2Jsb2Nrcyc6IFtbMTA2OSwgMzY3LCA5MF0sIFszNTQsIDEzNCwgNTBdLCBbNTYxLCAxMDYsIDQwXSwgWzgyOCwgMjMyLCA1MF0sIFs4NTUsIDM5MiwgNTBdLCBbNzExLCA1NzcsIDUwXSwgWzQ0NywgNDY2LCA1MF0sIFs0MzEsIDI1OCwgNjBdXSxcbiAgICAgICAgICAgICdzdGFydCc6IFs1MCwgMzYwXSxcbiAgICAgICAgICAgICdmaW5pc2gnOiBbMTIzMCwgMzYwXSxcbiAgICAgICAgICAgICdlbmQnOiBbMTEwLCAzNjBdXG4gICAgICAgIH0sIC8vIDE2XG4gICAgICAgIHtcbiAgICAgICAgICAgICdzcG9vbHMnOiBbWzMzNSwgMzA0LCA1MF0sIFs2NTUsIDI5OSwgNjBdLCBbOTYxLCAxOTEsIDUwXSwgWzMxOCwgNTg0LCA1MF0sIFs2NTAsIDU4MCwgNTBdLCBbMTAwNywgNTkxLCA1MF0sIFszNDYsIDExNSwgNDBdLCBbMTEzOSwgMTM2LCA1MF0sIFsxMTk4LCA1ODEsIDMwXSwgWzkwMSwgNDk3LCAzMF1dLFxuICAgICAgICAgICAgJ2lzb2xhdG9ycyc6IFtdLFxuICAgICAgICAgICAgJ2Jsb2Nrcyc6IFtbMTA5MCwgMjk0LCA3MF0sIFs5ODUsIDQ4NywgNDBdLCBbNzY1LCA0ODIsIDYwXSwgWzg0NiwgMTkyLCA1MF0sIFs1MzgsIDE0OSwgNTBdLCBbMTAzNywgMTM0LCAzMF0sIFsxMTM1LCA1MzAsIDMwXV0sXG4gICAgICAgICAgICAnc3RhcnQnOiBbNTAsIDM2MF0sXG4gICAgICAgICAgICAnZmluaXNoJzogWzEyMzAsIDM2MF0sXG4gICAgICAgICAgICAnZW5kJzogWzExMCwgMzYwXVxuICAgICAgICB9LFxuICAgIF1cbn07XG4iLCJjb25zdCBjcmVhdGVNb3VzZURyYWdTeXN0ZW0gPSAoaW5wdXRDb250cm9sOiBJbnB1dENvbnRyb2wpOiBVcGRhdGVTeXN0ZW0gPT4ge1xuICAgIGNvbnN0IHNwOiBWZWMyID0geyB4OiAwLCB5OiAwIH07XG4gICAgY29uc3Qgc3Bvb2xzOiBFbnRpdHlbXSA9IFtdO1xuICAgIGxldCBkcmFnRW50aXR5OiBNb3VzZURyYWdFbnRpdHk7XG4gICAgbGV0IGZpbmlzaEVudGl0eTogRmluaXNoRW50aXR5O1xuICAgIGxldCBpc0RyYWdnaW5nID0gZmFsc2U7XG4gICAgbGV0IGlzT3ZlciA9IGZhbHNlO1xuICBcbiAgICAvLyBGdW5jdGlvbiB0byBoYW5kbGUgdG91Y2ggZXZlbnRzXG4gICAgY29uc3QgaGFuZGxlVG91Y2hFdmVudHMgPSAoZTogVG91Y2hFdmVudCkgPT4ge1xuICAgICAgY29uc3QgdG91Y2ggPSBlLnRvdWNoZXNbMF07XG4gICAgICBpbnB1dENvbnRyb2wubW91c2VQb3MueCA9IHRvdWNoLmNsaWVudFg7XG4gICAgICBpbnB1dENvbnRyb2wubW91c2VQb3MueSA9IHRvdWNoLmNsaWVudFk7XG4gICAgICBlLnByZXZlbnREZWZhdWx0KCk7XG4gICAgfTtcbiAgXG4gICAgcmV0dXJuIHtcbiAgICAgIGFkZEVudGl0eTogKGVudGl0eSkgPT4ge1xuICAgICAgICAvLyBXZSBuZWVkIHRoZSBzcG9vbHMgdG8gY2hlY2sgaWYgd2UgY29sbGlkZVxuICAgICAgICBpZiAoZW50aXR5LnNwb29sICYmIChlbnRpdHkuc3Bvb2wudHlwZSA9PT0gTm9kZVR5cGUuc3Bvb2wgfHwgZW50aXR5LnNwb29sLnR5cGUgPT09IE5vZGVUeXBlLmlzb2xhdG9yKSkge1xuICAgICAgICAgIHNwb29scy5wdXNoKGVudGl0eSk7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKGVudGl0eS5maW5pc2gpIHtcbiAgICAgICAgICBmaW5pc2hFbnRpdHkgPSBlbnRpdHk7XG4gICAgICAgIH1cbiAgXG4gICAgICAgIGlmIChlbnRpdHkubW91c2VEcmFnKSB7XG4gICAgICAgICAgaW5wdXRDb250cm9sLmRyYWdDb250cm9sKGVudGl0eSwge1xuICAgICAgICAgICAgbW91c2VPdmVyOiAoKSA9PiB7XG4gICAgICAgICAgICAgIGlzT3ZlciA9IHRydWU7XG4gICAgICAgICAgICAgIGlmIChpbnB1dENvbnRyb2wuaXNNb3VzZURvd24oKSkge1xuICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICBkb2N1bWVudC5ib2R5LnN0eWxlLmN1cnNvciA9ICdwb2ludGVyJztcbiAgICAgICAgICAgICAgZHJhZ0VudGl0eSA9IGVudGl0eTtcbiAgICAgICAgICAgICAgZW50aXR5LnJlbmRlci5ob3ZlciA9IHRydWU7XG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgbW91c2VPdXQ6ICgpID0+IHtcbiAgICAgICAgICAgICAgZG9jdW1lbnQuYm9keS5zdHlsZS5jdXJzb3IgPSAnZGVmYXVsdCc7XG4gICAgICAgICAgICAgIGlzT3ZlciA9IGZhbHNlO1xuICAgICAgICAgICAgICBpZiAoIWlzRHJhZ2dpbmcpIHtcbiAgICAgICAgICAgICAgICBlbnRpdHkucmVuZGVyLmhvdmVyID0gZmFsc2U7XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICBtb3VzZURvd246ICgpID0+IHtcbiAgICAgICAgICAgICAgaXNEcmFnZ2luZyA9IHRydWU7XG4gICAgICAgICAgICAgIGNvcHlJbnRvVihzcCwgc3ViVihpbnB1dENvbnRyb2wubW91c2VQb3MsIGVudGl0eS5wb3MpKTtcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICBtb3VzZVVwOiAoKSA9PiB7XG4gICAgICAgICAgICAgIGlzRHJhZ2dpbmcgPSBmYWxzZTtcbiAgICAgICAgICAgICAgaWYgKCFpc092ZXIpIHtcbiAgICAgICAgICAgICAgICBlbnRpdHkucmVuZGVyLmhvdmVyID0gZmFsc2U7XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICBtb3VzZURvd25VcGRhdGU6ICgpID0+IHt9LFxuICAgICAgICAgIH0pO1xuICAgICAgICB9XG4gICAgICB9LFxuICAgICAgdXBkYXRlOiAodGltZTogbnVtYmVyKSA9PiB7XG4gICAgICAgIGlucHV0Q29udHJvbC51cGRhdGUoKTtcbiAgICAgICAgaWYgKCFkcmFnRW50aXR5KSB7XG4gICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG4gIFxuICAgICAgICBpc0RyYWdnaW5nICYmIGNvcHlJbnRvVihkcmFnRW50aXR5LnBvcywgc3ViVihpbnB1dENvbnRyb2wubW91c2VQb3MsIHNwKSk7XG4gIFxuICAgICAgICBjb25zdCB2MSA9IGRyYWdFbnRpdHkucG9zO1xuICBcbiAgICAgICAgLy8gUHVzaCBhd2F5IGZyb20gdGhlIGJvcmRlclxuICAgICAgICB2MS54ID0gY2xhbXAodjEueCwgMCwgMTI4MCk7XG4gICAgICAgIHYxLnkgPSBjbGFtcCh2MS55LCAwLCA3MjApO1xuICBcbiAgICAgICAgLy8gUHVzaCBlbmQgbm9kZSBhd2F5IGZyb20gc3Bvb2xzXG4gICAgICAgIHNwb29scy5mb3JFYWNoKChzcG9vbCkgPT4ge1xuICAgICAgICAgIGlmIChzcG9vbCA9PT0gZHJhZ0VudGl0eSkge1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgIH1cbiAgICAgICAgICBjb25zdCB2MiA9IHNwb29sLnBvcztcbiAgICAgICAgICBjb25zdCBkaXN0ID0gMTAgKyBzcG9vbC5zcG9vbC5zaXplO1xuICAgICAgICAgIGlmIChkaXN0Vih2MSwgdjIpIDwgZGlzdCkge1xuICAgICAgICAgICAgY29uc3QgZGlyID0gbm9ybWFsaXplVihzdWJWKHYxLCB2MikpO1xuICAgICAgICAgICAgaWYgKGRpci54ID09PSAwICYmIGRpci55ID09PSAwKSB7XG4gICAgICAgICAgICAgIGRpci54ID0gMTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGNvbnN0IHYgPSBtdWxWUyhkaXIsIGRpc3QpO1xuICAgICAgICAgICAgZHJhZ0VudGl0eS5wb3MgPSBhZGRWKHYyLCB2KTtcbiAgICAgICAgICB9XG4gICAgICAgIH0pO1xuICBcbiAgICAgICAgLy8gU25hcCB0byBmaW5pc2hcbiAgICAgICAgaWYgKGRpc3RWKHYxLCBmaW5pc2hFbnRpdHkucG9zKSA8IDMwKSB7XG4gICAgICAgICAgZmluaXNoRW50aXR5LmZpbmlzaC5jb25uZWN0ZWQgPSB0cnVlO1xuICAgICAgICAgIGNvcHlJbnRvVihkcmFnRW50aXR5LnBvcywgZmluaXNoRW50aXR5LnBvcyk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgZmluaXNoRW50aXR5LmZpbmlzaC5jb25uZWN0ZWQgPSBmYWxzZTtcbiAgICAgICAgfVxuICAgICAgfSxcbiAgICB9O1xuICB9O1xuICAiLCJcbmNvbnN0IGNyZWF0ZVNwb29sUmVuZGVyU3lzdGVtID0gKHJlc291cmNlczogUmVzb3VyY2VzKTogUmVuZGVyU3lzdGVtID0+IHtcbiAgICBjb25zdCBlbnRpdGllczogRW50aXR5W10gPSBbXTtcbiAgICBjb25zdCB7Y29pbHMsIGJsb2NrcywgaXNvbGF0b3JzLCBkcmFnLCBmaW5pc2gsIHN0YXJ0fSA9IHJlc291cmNlcztcblxuICAgIHJldHVybiB7XG4gICAgICAgIGFkZEVudGl0eTogKGVudGl0eTogRW50aXR5KSA9PiB7XG4gICAgICAgICAgICBpZiAoZW50aXR5LnJlbmRlcikge1xuICAgICAgICAgICAgICAgIGVudGl0aWVzLnB1c2goZW50aXR5KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSxcbiAgICAgICAgcmVuZGVyOiAoY29udGV4dDogQ29udGV4dCwgdGltZTogbnVtYmVyKSA9PiB7XG4gICAgICAgICAgICBlbnRpdGllcy5mb3JFYWNoKGVudGl0eSA9PiB7XG4gICAgICAgICAgICAgICAgc3dpdGNoIChlbnRpdHkucmVuZGVyLnR5cGUpIHtcbiAgICAgICAgICAgICAgICAgICAgY2FzZSBOb2RlVHlwZS5zcG9vbDpcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnRleHQuZHJhd0ltYWdlKGNvaWxzW2VudGl0eS5zcG9vbC5zaXplXSwgZW50aXR5LnBvcy54IC0gZW50aXR5LnNwb29sLnNpemUgLSA2LCBlbnRpdHkucG9zLnkgLSBlbnRpdHkuc3Bvb2wuc2l6ZSAtIDYpO1xuICAgICAgICAgICAgICAgICAgICAgICAgY29udGV4dC5kcmF3SW1hZ2UocmVzb3VyY2VzLmxlZCwgZW50aXR5LnBvcy54IC0gMTEsIGVudGl0eS5wb3MueSAtIDExKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChlbnRpdHkuc3Bvb2wub3ZlcnBvd2VyZWQpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb250ZXh0LmRyYXdJbWFnZShyZXNvdXJjZXMucmVkR2xvdywgZW50aXR5LnBvcy54IC0gNDAsIGVudGl0eS5wb3MueSAtIDQwKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH0gZWxzZSBpZiAoZW50aXR5LnNwb29sLnBvd2VyZWQpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb250ZXh0LmRyYXdJbWFnZShyZXNvdXJjZXMuZ3JlZW5HbG93LCBlbnRpdHkucG9zLnggLSA0MCwgZW50aXR5LnBvcy55IC0gNDApO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgICAgICAgIGNhc2UgTm9kZVR5cGUuaXNvbGF0b3I6XG4gICAgICAgICAgICAgICAgICAgICAgICBjb250ZXh0LmRyYXdJbWFnZShpc29sYXRvcnNbZW50aXR5LnNwb29sLnNpemVdLCBlbnRpdHkucG9zLnggLSBlbnRpdHkuc3Bvb2wuc2l6ZSAtIDYsIGVudGl0eS5wb3MueSAtIGVudGl0eS5zcG9vbC5zaXplIC0gNik7XG4gICAgICAgICAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgICAgICAgY2FzZSBOb2RlVHlwZS5ibG9jazpcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnRleHQuc2F2ZSgpO1xuICAgICAgICAgICAgICAgICAgICAgICAgY29udGV4dC50cmFuc2xhdGUoZW50aXR5LnBvcy54LCBlbnRpdHkucG9zLnkpO1xuICAgICAgICAgICAgICAgICAgICAgICAgY29udGV4dC5yb3RhdGUodGltZSk7XG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBzcHJpdGUgPSBibG9ja3NbZW50aXR5LmJsb2NrLnNpemVdO1xuICAgICAgICAgICAgICAgICAgICAgICAgY29udGV4dC5kcmF3SW1hZ2Uoc3ByaXRlLCAtc3ByaXRlLndpZHRoIC8gMiwgLXNwcml0ZS5oZWlnaHQgLyAyKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnRleHQucmVzdG9yZSgpO1xuICAgICAgICAgICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgICAgICAgIGNhc2UgTm9kZVR5cGUuZmluaXNoOlxuICAgICAgICAgICAgICAgICAgICAgICAgY29udGV4dC5kcmF3SW1hZ2UoZmluaXNoLCBlbnRpdHkucG9zLnggLSAzMiwgZW50aXR5LnBvcy55IC0gMzIpO1xuICAgICAgICAgICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgICAgICAgIGNhc2UgTm9kZVR5cGUuc3RhcnQ6XG4gICAgICAgICAgICAgICAgICAgICAgICBjb250ZXh0LmRyYXdJbWFnZShzdGFydCwgZW50aXR5LnBvcy54IC0gMjQsIGVudGl0eS5wb3MueSAtIDI0KTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICAgICAgICBjYXNlIE5vZGVUeXBlLmVuZDpcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnRleHQuZHJhd0ltYWdlKGRyYWcsIGVudGl0eS5wb3MueCAtIDMyLCBlbnRpdHkucG9zLnkgLSAzMik7XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoZW50aXR5LnJlbmRlci5ob3Zlcikge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbnRleHQuZ2xvYmFsQWxwaGEgPSAwLjggKyAoMC4yICogTWF0aC5zaW4odGltZSAqIDYpKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb250ZXh0LmRyYXdJbWFnZShyZXNvdXJjZXMuZHJhZ0dsb3csIGVudGl0eS5wb3MueCAtIDMxLCBlbnRpdHkucG9zLnkgLSAzMSk7XG4gICAgICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbnRleHQuZ2xvYmFsQWxwaGEgPSAwLjIgKyAoMC4yICogTWF0aC5zaW4odGltZSAqIDMpKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb250ZXh0LmRyYXdJbWFnZShyZXNvdXJjZXMuZHJhZ0dsb3csIGVudGl0eS5wb3MueCAtIDMxLCBlbnRpdHkucG9zLnkgLSAzMSk7XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICBjb250ZXh0Lmdsb2JhbEFscGhhID0gMTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGJyZWFrO1xuXG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSk7XG4gICAgICAgIH1cbiAgICB9O1xufTtcblxuY29uc3QgY3JlYXRlQ2FibGVSZW5kZXJTeXN0ZW0gPSAoKTogUmVuZGVyU3lzdGVtID0+IHtcbiAgICBjb25zdCBlbnRpdGllczogRW50aXR5W10gPSBbXTtcbiAgICByZXR1cm4ge1xuICAgICAgICBhZGRFbnRpdHk6IChlbnRpdHk6IEVudGl0eSkgPT4ge1xuICAgICAgICAgICAgaWYgKGVudGl0eS5jYWJsZSkge1xuICAgICAgICAgICAgICAgIGVudGl0aWVzLnB1c2goZW50aXR5KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSxcbiAgICAgICAgcmVuZGVyOiAoY29udGV4dDogQ29udGV4dCkgPT4ge1xuXG4gICAgICAgICAgICBlbnRpdGllcy5mb3JFYWNoKGVudGl0eSA9PiB7XG4gICAgICAgICAgICAgICAgY29uc3QgYXR0YWNobWVudHMgPSBlbnRpdHkuY2FibGUuYXR0YWNobWVudHM7XG4gICAgICAgICAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBhdHRhY2htZW50cy5sZW5ndGggLSAxOyBpKyspIHtcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgYSA9IGF0dGFjaG1lbnRzW2ldO1xuICAgICAgICAgICAgICAgICAgICBjb25zdCBiID0gYXR0YWNobWVudHNbaSArIDFdO1xuXG4gICAgICAgICAgICAgICAgICAgIGNvbnRleHQuc2F2ZSgpO1xuXG4gICAgICAgICAgICAgICAgICAgIGlmIChhLm92ZXJsYXApIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnRleHQuc2V0TGluZURhc2goWzUsIDEwXSk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgaWYgKGEuaXNvbGF0ZWQpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnRleHQuc3Ryb2tlU3R5bGUgPSAnI2QwNDUzMyc7XG4gICAgICAgICAgICAgICAgICAgICAgICBjb250ZXh0LmxpbmVXaWR0aCA9IDU7XG4gICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBjb250ZXh0LnN0cm9rZVN0eWxlID0gJ3doaXRlJztcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnRleHQubGluZVdpZHRoID0gMztcbiAgICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgICAgIGNvbnRleHQubGluZUNhcCA9ICdyb3VuZCc7XG4gICAgICAgICAgICAgICAgICAgIGNvbnRleHQuYmVnaW5QYXRoKCk7XG4gICAgICAgICAgICAgICAgICAgIGNvbnRleHQubW92ZVRvKGEub3V0UG9zIS54LCBhLm91dFBvcyEueSk7XG4gICAgICAgICAgICAgICAgICAgIGNvbnRleHQubGluZVRvKGIuaW5Qb3MhLngsIGIuaW5Qb3MhLnkpO1xuICAgICAgICAgICAgICAgICAgICBjb250ZXh0LnN0cm9rZSgpO1xuXG4gICAgICAgICAgICAgICAgICAgIGNvbnRleHQucmVzdG9yZSgpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9XG4gICAgfTtcbn07XG4iLCIvLy8gPHJlZmVyZW5jZSBwYXRoPVwiZ2Z4LWdlbmVyYXRvci50c1wiIC8+XG50eXBlIFNwcml0ZU1hcCA9IHsgW3NpemU6IG51bWJlcl06IENhbnZhcyB9O1xudHlwZSBSZXNMb2FkQ2FsbHMgPSAoKSA9PiB2b2lkO1xudHlwZSBSZXNvdXJjZXMgPSB7XG4gICAgY29pbHM6IFNwcml0ZU1hcDtcbiAgICBibG9ja3M6IFNwcml0ZU1hcDtcbiAgICBpc29sYXRvcnM6IFNwcml0ZU1hcDtcbiAgICBsZWQ6IENhbnZhcztcbiAgICBkcmFnOiBDYW52YXM7XG4gICAgZHJhZ0dsb3c6IENhbnZhcztcbiAgICBmaW5pc2g6IENhbnZhcztcbiAgICBzdGFydDogQ2FudmFzO1xuICAgIGdyZWVuR2xvdzogQ2FudmFzO1xuICAgIHJlZEdsb3c6IENhbnZhcztcbiAgICB0dXRvcmlhbDE6IENhbnZhcztcbiAgICB0dXRvcmlhbDI6IENhbnZhcztcbn07XG5jb25zdCBnZW5lcmF0ZVJlc291cmNlcyA9IChvblByb2dyZXNzOiAocGVyY2VudDogbnVtYmVyKSA9PiB2b2lkLCBvbkRvbmU6IChyZXNvdXJjZXM6IFJlc291cmNlcykgPT4gdm9pZCkgPT4ge1xuICAgIGNvbnN0IHJlc0NhbGxzOiBSZXNMb2FkQ2FsbHNbXSA9IFtdO1xuICAgIGNvbnN0IGNvaWxTcHJpdGVzOiBTcHJpdGVNYXAgPSB7fTtcbiAgICBjb25zdCBibG9ja1Nwcml0ZXM6IFNwcml0ZU1hcCA9IHt9O1xuICAgIGNvbnN0IGlzb2xhdG9yU3ByaXRlczogU3ByaXRlTWFwID0ge307XG4gICAgWzMwLCA0MCwgNTAsIDYwLCA3MCwgODAsIDkwLCAxMDAsIDExMCwgMTIwLCAxMzAsIDE0MCwgMTUwLCAxNjBdLmZvckVhY2goc2l6ZSA9PiB7XG4gICAgICAgIHJlc0NhbGxzLnB1c2goKCkgPT4ge1xuICAgICAgICAgICAgY29pbFNwcml0ZXNbc2l6ZV0gPSBjcmVhdGVDb2lsU3ByaXRlKHNpemUgKiAyICsgMTApO1xuICAgICAgICB9KTtcbiAgICB9KTtcbiAgICBbMzAsIDQwLCA1MCwgNjAsIDcwLCA4MCwgOTAsIDEwMCwgMTEwLCAxMjAsIDEzMCwgMTQwLCAxNTAsIDE2MF0uZm9yRWFjaChzaXplID0+IHtcbiAgICAgICAgcmVzQ2FsbHMucHVzaCgoKSA9PiB7XG4gICAgICAgICAgICBibG9ja1Nwcml0ZXNbc2l6ZV0gPSBjcmVhdGVCbG9ja1Nwcml0ZShzaXplICogMiArIDYpO1xuICAgICAgICB9KTtcbiAgICB9KTtcbiAgICBbMzAsIDQwLCA1MCwgNjAsIDcwLCA4MF0uZm9yRWFjaChzaXplID0+IHtcbiAgICAgICAgcmVzQ2FsbHMucHVzaCgoKSA9PiB7XG4gICAgICAgICAgICBpc29sYXRvclNwcml0ZXNbc2l6ZV0gPSBjcmVhdGVJc29sYXRvclNwcml0ZShzaXplICogMiArIDEwKTtcbiAgICAgICAgfSk7XG4gICAgfSk7XG5cbiAgICBjb25zdCBsZWQgPSBjcmVhdGVMZWRTcHJpdGUoKTtcbiAgICBjb25zdCBncmVlbkdsb3cgPSBjcmVhdGVHbG93KG5ld0NvbCgwLCAxLCAwKSk7XG4gICAgY29uc3QgcmVkR2xvdyA9IGNyZWF0ZUdsb3cobmV3Q29sKDEsIDAsIDApKTtcbiAgICBjb25zdCBkcmFnUG9pbnQgPSBjcmVhdGVDb25uZWN0b3JCdXR0b25zKG5ld0NvbCgwLjIsIDAuNiwgMC4yKSw3MCk7XG4gICAgY29uc3Qgc3RhcnQgPSBjcmVhdGVDb25uZWN0b3JCdXR0b25zKG5ld0NvbCgwLCAwLCAwKSw1Mik7XG4gICAgY29uc3QgZHJhZ0dsb3cgPSBjcmVhdGVSaW5nR2xvdyhuZXdDb2woMCwgMSwgMCkpO1xuICAgIGNvbnN0IGZpbmlzaCA9IGNyZWF0ZUNvbm5lY3RvckJ1dHRvbnMobmV3Q29sKDEsIDAuNCwgMC40KSw3MCk7XG5cbiAgICAvL1R1dG9yaWFsIFNjcmVlbnNcbiAgICBjb25zdCBbdHV0b3JpYWwxLCB0dXRDdHgxXSA9IGNyZWF0ZUNhbnZhcyg0NTAsIDI2NCk7XG4gICAgdHV0b3JpYWwxLmNsYXNzTmFtZSA9ICd0dXRvcmlhbCc7XG4gICAgdHV0Q3R4MS5mb250ID0gJzIwcHggc2Fucy1zZXJpZic7XG4gICAgdHV0Q3R4MS5maWxsU3R5bGUgPSAnI2NjYyc7XG4gICAgdHV0Q3R4MS5maWxsVGV4dCgnMS4gRHJhZyB0aGUgY2FibGUgLi4uJywgMjAsIDUwKTtcbiAgICB0dXRDdHgxLmRyYXdJbWFnZShkcmFnUG9pbnQsIDM1OCwgMTApO1xuICAgIHR1dEN0eDEuZmlsbFRleHQoJzIuIC4uLmFyb3VuZCB0aGUgcG93ZXIgbm9kZXMuLi4nLCAyMCwgMTQwKTtcbiAgICB0dXRDdHgxLmRyYXdJbWFnZShjcmVhdGVDb2lsU3ByaXRlKDgwKSwgMzUwLCA5MCk7XG4gICAgdHV0Q3R4MS5maWxsVGV4dCgnMy4gLi4uYW5kIHBsdWcgaXQgaW50byB0aGUgc29ja2V0IScsIDIwLCAyMzApO1xuICAgIHR1dEN0eDEuZHJhd0ltYWdlKGZpbmlzaCwgMzU4LCAxOTApO1xuXG4gICAgY29uc3QgW3R1dG9yaWFsMiwgdHV0Q3R4Ml0gPSBjcmVhdGVDYW52YXMoNDUwLCAxMDApO1xuICAgIHR1dG9yaWFsMi5jbGFzc05hbWUgPSAndHV0b3JpYWwnO1xuICAgIHR1dEN0eDIuZm9udCA9ICcyMHB4IHNhbnMtc2VyaWYnO1xuICAgIHR1dEN0eDIuZmlsbFN0eWxlID0gJyNjY2MnO1xuICAgIHR1dEN0eDIuZmlsbFRleHQoJ0lzb2xhdGVkIGNhYmxlcyBjYW4gb3ZlcmxhcCBvdGhlcnMgJywgMjAsIDU1KTtcbiAgICB0dXRDdHgyLmRyYXdJbWFnZShjcmVhdGVJc29sYXRvclNwcml0ZSg4MCksIDM1OCwgMTApO1xuXG5cbiAgICBjb25zdCBudW1SZXNvdXJjZXMgPSByZXNDYWxscy5sZW5ndGg7XG4gICAgbGV0IG51bUdlbmVyYXRlZCA9IDA7XG4gICAgKGZ1bmN0aW9uIG5leHRSZXMoKSB7XG4gICAgICAgIGNvbnN0IG5leHRDYWxsID0gcmVzQ2FsbHMuc2hpZnQoKTtcbiAgICAgICAgaWYgKG5leHRDYWxsKSB7XG4gICAgICAgICAgICBuZXh0Q2FsbCgpO1xuICAgICAgICAgICAgb25Qcm9ncmVzcygxMDAgLyBudW1SZXNvdXJjZXMgKiArK251bUdlbmVyYXRlZCk7XG4gICAgICAgICAgICByZXF1ZXN0QW5pbWF0aW9uRnJhbWUobmV4dFJlcyk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBvbkRvbmUoe1xuICAgICAgICAgICAgICAgIGNvaWxzOiBjb2lsU3ByaXRlcyxcbiAgICAgICAgICAgICAgICBibG9ja3M6IGJsb2NrU3ByaXRlcyxcbiAgICAgICAgICAgICAgICBpc29sYXRvcnM6IGlzb2xhdG9yU3ByaXRlcyxcbiAgICAgICAgICAgICAgICBncmVlbkdsb3csXG4gICAgICAgICAgICAgICAgcmVkR2xvdyxcbiAgICAgICAgICAgICAgICBsZWQsXG4gICAgICAgICAgICAgICAgZHJhZzogZHJhZ1BvaW50LFxuICAgICAgICAgICAgICAgIGRyYWdHbG93LFxuICAgICAgICAgICAgICAgIGZpbmlzaCxcbiAgICAgICAgICAgICAgICB0dXRvcmlhbDEsXG4gICAgICAgICAgICAgICAgdHV0b3JpYWwyLFxuICAgICAgICAgICAgICAgIHN0YXJ0XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfVxuICAgIH0pKCk7XG5cbn07XG4iLCJ0eXBlIFN5c3RlbSA9IHtcbiAgICBhZGRFbnRpdHk6IChlbnRpdHk6IEVudGl0eSkgPT4gdm9pZDtcbiAgICB1cGRhdGU/OiAodGltZTogbnVtYmVyKSA9PiB2b2lkO1xuICAgIHNodXRkb3duPzogKCkgPT4gdm9pZDtcbn07XG50eXBlIFJlbmRlclN5c3RlbSA9IFN5c3RlbSAmIHsgcmVuZGVyOiAoY29udGV4dDogQ29udGV4dCwgdGltZTogbnVtYmVyKSA9PiB2b2lkIH1cbnR5cGUgVXBkYXRlU3lzdGVtID0gU3lzdGVtICYgeyB1cGRhdGU6ICh0aW1lOiBudW1iZXIpID0+IHZvaWQgfVxuXG5pbnRlcmZhY2UgU3BhY2Uge1xuICAgIGVudGl0aWVzOiBQYXJ0aWFsPEVudGl0eT5bXTtcblxuICAgIHJlZ2lzdGVyU3lzdGVtKHN5c3RlbTogU3lzdGVtKTogdm9pZDtcblxuICAgIGFkZEVudGl0eShlbnRpdHk6IFBhcnRpYWw8RW50aXR5Pik6IHZvaWQ7XG5cbiAgICBzaHV0ZG93bigpOiB2b2lkO1xufVxuXG5jb25zdCBjcmVhdGVTcGFjZSA9ICgpOiBTcGFjZSA9PiB7XG4gICAgY29uc3Qgc3lzdGVtczogU3lzdGVtW10gPSBbXTtcbiAgICBjb25zdCBlbnRpdGllczogUGFydGlhbDxFbnRpdHk+W10gPSBbXTtcblxuICAgIHJldHVybiB7XG4gICAgICAgIHJlZ2lzdGVyU3lzdGVtOiAoc3lzdGVtOiBTeXN0ZW0pID0+IHtcbiAgICAgICAgICAgIHN5c3RlbXMucHVzaChzeXN0ZW0pO1xuICAgICAgICB9LFxuICAgICAgICBhZGRFbnRpdHk6IChlbnRpdHk6IFBhcnRpYWw8RW50aXR5PikgPT4ge1xuICAgICAgICAgICAgZW50aXRpZXMucHVzaChlbnRpdHkpO1xuICAgICAgICAgICAgc3lzdGVtcy5mb3JFYWNoKHN5c3RlbSA9PiB7XG4gICAgICAgICAgICAgICAgc3lzdGVtLmFkZEVudGl0eShlbnRpdHkgYXMgRW50aXR5KTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9LFxuICAgICAgICBzaHV0ZG93bjooKT0+IHtcbiAgICAgICAgICAgIHN5c3RlbXMuZm9yRWFjaChzeXN0ZW0gPT4gc3lzdGVtLnNodXRkb3duICYmIHN5c3RlbS5zaHV0ZG93bigpKTtcbiAgICAgICAgfSxcbiAgICAgICAgZW50aXRpZXNcbiAgICB9O1xufTtcbiIsImNvbnN0IGNhbGN1bGF0ZVRhbmdlbnRzID0gZnVuY3Rpb24gKGF0dGFjaG1lbnRzOiBBdHRhY2htZW50W10pIHtcbiAgICBmb3IgKGxldCBpID0gMDsgaSA8IGF0dGFjaG1lbnRzLmxlbmd0aCAtIDE7IGkrKykge1xuICAgICAgICBjb25zdCBhID0gYXR0YWNobWVudHNbaV07XG4gICAgICAgIGNvbnN0IGIgPSBhdHRhY2htZW50c1tpICsgMV07XG4gICAgICAgIGNvbnN0IHRhbmdlbnRzID0gZ2V0VGFuZ2VudHMoYS5lbnRpdHkucG9zLCBhLmVudGl0eS5zcG9vbC5zaXplLCBiLmVudGl0eS5wb3MsIGIuZW50aXR5LnNwb29sLnNpemUpO1xuICAgICAgICBjb25zdCBpZHggPSBhLnNpZGUgPT0gU2lkZS5sZWZ0ID8gYi5zaWRlID09IFNpZGUubGVmdCA/IDEgOiAzIDogYi5zaWRlID09IFNpZGUubGVmdCA/IDIgOiAwO1xuXG4gICAgICAgIGlmICghdGFuZ2VudHNbaWR4XSkge1xuXG4gICAgICAgIH1cbiAgICAgICAgYS5vdXRQb3MgPSB0YW5nZW50c1tpZHhdWzBdO1xuICAgICAgICBiLmluUG9zID0gdGFuZ2VudHNbaWR4XVsxXTtcbiAgICB9XG59O1xuXG5jb25zdCBnZXRJbnRlcnNlY3Rpb25zID0gKGE6IFZlYzIsIGI6IFZlYzIsIHNwb29sRW50aXRpZXM6IFNwb29sRW50aXR5W10sIGlnbm9yZUE6IFNwb29sRW50aXR5LCBpZ25vcmVCOiBTcG9vbEVudGl0eSk6IFNwb29sRW50aXR5W10gPT4ge1xuICAgIHJldHVybiBzcG9vbEVudGl0aWVzXG4gICAgICAgIC5maWx0ZXIoc3Bvb2xFbnRpdHkgPT5cbiAgICAgICAgICAgIChzcG9vbEVudGl0eSAhPSBpZ25vcmVBICYmIHNwb29sRW50aXR5ICE9IGlnbm9yZUIpICYmXG4gICAgICAgICAgICBsaW5lQ2lyY2xlSW50ZXJzZWN0KGEsIGIsIHNwb29sRW50aXR5LnBvcywgc3Bvb2xFbnRpdHkuc3Bvb2wuc2l6ZSlcbiAgICAgICAgKVxuICAgICAgICAuc29ydCgoY2EsIGNiKSA9PiBkaXN0MihjYS5wb3MsIGEpID4gZGlzdDIoY2IucG9zLCBhKSA/IDEgOiAtMSk7IC8vVE9ETzogbmVlZCB0byBhZGQgdGhlIHJhZGl1c1xufTtcblxuY29uc3QgcmVzb2x2ZUNvbm5lY3Rpb25zID0gZnVuY3Rpb24gKGF0dGFjaG1lbnRzOiBBdHRhY2htZW50W10sIHNwb29sczogU3Bvb2xFbnRpdHlbXSkge1xuICAgIGxldCByZXNvbHZlZDogYm9vbGVhbjtcbiAgICBkbyB7XG4gICAgICAgIHJlc29sdmVkID0gdHJ1ZTtcbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBhdHRhY2htZW50cy5sZW5ndGggLSAxOyBpKyspIHtcbiAgICAgICAgICAgIGNvbnN0IGEgPSBhdHRhY2htZW50c1tpXTtcbiAgICAgICAgICAgIGNvbnN0IGIgPSBhdHRhY2htZW50c1tpICsgMV07XG4gICAgICAgICAgICBjb25zdCBlbnRpdHkgPSBnZXRJbnRlcnNlY3Rpb25zKGEub3V0UG9zISwgYi5pblBvcyEsIHNwb29scywgYS5lbnRpdHksIGIuZW50aXR5KVswXTtcbiAgICAgICAgICAgIGlmIChlbnRpdHkgKSB7XG4gICAgICAgICAgICAgICAgaWYgKGVudGl0eS5zcG9vbC5pc0F0dGFjaGVkKSB7XG4gICAgICAgICAgICAgICAgICAgIC8vIG5vZGUgYWxyZWFkeSBjb25uZWN0ZWRcbiAgICAgICAgICAgICAgICAgICAgYS5vdmVybGFwID0gdHJ1ZTtcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAvLyB3ZSBoYXZlIGEgY29ubmVjdGlvblxuICAgICAgICAgICAgICAgICAgICBlbnRpdHkuc3Bvb2wuaXNBdHRhY2hlZCA9IHRydWU7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IHNpZGUgPSBzaWRlT2ZMaW5lKGEub3V0UG9zISwgYi5pblBvcyEsIGVudGl0eS5wb3MpO1xuICAgICAgICAgICAgICAgICAgICBjb25zdCBhdHRhY2htZW50OiBBdHRhY2htZW50ID0ge2VudGl0eTogZW50aXR5LCBzaWRlfTtcbiAgICAgICAgICAgICAgICAgICAgYXR0YWNobWVudHMuc3BsaWNlKGkgKyAxLCAwLCBhdHRhY2htZW50KTtcbiAgICAgICAgICAgICAgICAgICAgcmVzb2x2ZWQgPSBmYWxzZTtcbiAgICAgICAgICAgICAgICAgICAgY2FsY3VsYXRlVGFuZ2VudHMoW2EsIGF0dGFjaG1lbnQsIGJdKTtcbiAgICAgICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfSB3aGlsZSAoIXJlc29sdmVkKTtcbn07XG5cbmNvbnN0IHJlc29sdmVEaXNjb25uZWN0aW9ucyA9IGZ1bmN0aW9uIChhdHRhY2htZW50czogQXR0YWNobWVudFtdKSB7XG4gICAgbGV0IHJlc29sdmVkOiBib29sZWFuO1xuICAgIGRvIHtcbiAgICAgICAgcmVzb2x2ZWQgPSB0cnVlO1xuICAgICAgICBmb3IgKGxldCBpID0gMTsgaSA8IGF0dGFjaG1lbnRzLmxlbmd0aCAtIDE7IGkrKykge1xuICAgICAgICAgICAgY29uc3QgYSA9IGF0dGFjaG1lbnRzW2kgLSAxXTtcbiAgICAgICAgICAgIGNvbnN0IGIgPSBhdHRhY2htZW50c1tpXTtcbiAgICAgICAgICAgIGNvbnN0IGMgPSBhdHRhY2htZW50c1tpICsgMV07XG5cbiAgICAgICAgICAgIGNvbnN0IHZBQiA9IHN1YlYoYS5vdXRQb3MhLCBiLmluUG9zISk7XG4gICAgICAgICAgICBjb25zdCB2QkMgPSBzdWJWKGIub3V0UG9zISwgYy5pblBvcyEpO1xuICAgICAgICAgICAgbGV0IGFuZ2xlID0gTWF0aC5hdGFuMih2QkMueSwgdkJDLngpIC0gTWF0aC5hdGFuMih2QUIueSwgdkFCLngpO1xuICAgICAgICAgICAgaWYgKGFuZ2xlIDwgMCkgYW5nbGUgKz0gMiAqIE1hdGguUEk7XG4gICAgICAgICAgICBpZiAoKGIuc2lkZSA9PSBTaWRlLmxlZnQgJiYgYW5nbGUgPiBNYXRoLlBJICogMS44KSB8fFxuICAgICAgICAgICAgICAgIChiLnNpZGUgPT0gU2lkZS5yaWdodCAmJiBhbmdsZSA8IE1hdGguUEkgKiAwLjIpKSB7XG4gICAgICAgICAgICAgICAgYXR0YWNobWVudHMuc3BsaWNlKGksIDEpO1xuICAgICAgICAgICAgICAgIGIuZW50aXR5LnNwb29sLmlzQXR0YWNoZWQgPSBmYWxzZTtcbiAgICAgICAgICAgICAgICByZXNvbHZlZCA9IGZhbHNlO1xuICAgICAgICAgICAgICAgIGNhbGN1bGF0ZVRhbmdlbnRzKFthLCBjXSk7XG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9IHdoaWxlICghcmVzb2x2ZWQpO1xufTtcblxuY29uc3QgY3JlYXRlU3Bvb2xTeXN0ZW0gPSAob25MZXZlbENvbXBsZXRlZDogKCkgPT4gdm9pZCk6IFVwZGF0ZVN5c3RlbSA9PiB7XG4gICAgY29uc3Qgc3Bvb2xFbnRpdGllczogU3Bvb2xFbnRpdHlbXSA9IFtdO1xuICAgIGNvbnN0IGJsb2NrRW50aXRpZXM6IEJsb2NrRW50aXR5W10gPSBbXTtcbiAgICBjb25zdCBjYWJsZXM6IENhYmxlRW50aXR5W10gPSBbXTtcbiAgICBsZXQgZmluaXNoRW50aXR5OiBGaW5pc2hFbnRpdHk7XG4gICAgbGV0IGxhc3RQb3dlcmVkU3Bvb2xzID0wO1xuICAgIGxldCBudW1TcG9vbHMgPSAwO1xuXG4gICAgcmV0dXJuIHtcbiAgICAgICAgYWRkRW50aXR5OiAoZW50aXR5OiBFbnRpdHkpID0+IHtcbiAgICAgICAgICAgIGlmIChlbnRpdHkuc3Bvb2wpIHtcbiAgICAgICAgICAgICAgICBzcG9vbEVudGl0aWVzLnB1c2goZW50aXR5KTtcbiAgICAgICAgICAgICAgICBpZiAoZW50aXR5LnNwb29sLnR5cGUgPT0gTm9kZVR5cGUuc3Bvb2wpIHtcbiAgICAgICAgICAgICAgICAgICAgbnVtU3Bvb2xzKys7XG4gICAgICAgICAgICAgICAgICAgIG5vZGVJbmZvLmlubmVySFRNTCA9IDAgKyAnIC8gJyArIG51bVNwb29scztcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZiAoZW50aXR5LmNhYmxlKSB7XG4gICAgICAgICAgICAgICAgY2FibGVzLnB1c2goZW50aXR5KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGlmIChlbnRpdHkuYmxvY2spIHtcbiAgICAgICAgICAgICAgICBibG9ja0VudGl0aWVzLnB1c2goZW50aXR5KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGlmIChlbnRpdHkuZmluaXNoKSB7XG4gICAgICAgICAgICAgICAgZmluaXNoRW50aXR5ID0gZW50aXR5O1xuICAgICAgICAgICAgfVxuICAgICAgICB9LFxuICAgICAgICB1cGRhdGU6ICh0aW1lOiBudW1iZXIpID0+IHtcbiAgICAgICAgICAgIGNhYmxlcy5mb3JFYWNoKGNhYmxlID0+IHtcbiAgICAgICAgICAgICAgICBjb25zdCBhdHRhY2htZW50cyA9IGNhYmxlLmNhYmxlLmF0dGFjaG1lbnRzO1xuXG4gICAgICAgICAgICAgICAgLy8gcmVzZXQgc3RhdGVzXG4gICAgICAgICAgICAgICAgY2FibGUuY2FibGUub3ZlcnBvd2VyZWQgPSBmYWxzZTtcbiAgICAgICAgICAgICAgICBhdHRhY2htZW50cy5mb3JFYWNoKGF0dGFjaG1lbnQgPT4ge1xuICAgICAgICAgICAgICAgICAgICBhdHRhY2htZW50Lm92ZXJsYXAgPSBmYWxzZTtcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICBzcG9vbEVudGl0aWVzLmZvckVhY2goc3Bvb2wgPT4ge1xuICAgICAgICAgICAgICAgICAgICBzcG9vbC5zcG9vbC5wb3dlcmVkID0gc3Bvb2wuc3Bvb2wub3ZlcnBvd2VyZWQgPSBmYWxzZTtcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICBsZXQgbnVtUG93ZXJlZFNwb29scyA9IDA7XG5cblxuICAgICAgICAgICAgICAgIGNhbGN1bGF0ZVRhbmdlbnRzKGF0dGFjaG1lbnRzKTtcbiAgICAgICAgICAgICAgICByZXNvbHZlQ29ubmVjdGlvbnMoYXR0YWNobWVudHMsIHNwb29sRW50aXRpZXMpO1xuICAgICAgICAgICAgICAgIHJlc29sdmVEaXNjb25uZWN0aW9ucyhhdHRhY2htZW50cyk7XG5cbiAgICAgICAgICAgICAgICAvLyBzZXQgaXNvbGF0ZWQgc3RhdHVzXG4gICAgICAgICAgICAgICAgbGV0IGlzSXNvbGF0ZWQgPSBmYWxzZTtcbiAgICAgICAgICAgICAgICBjYWJsZS5jYWJsZS5hdHRhY2htZW50cy5mb3JFYWNoKGF0dGFjaG1lbnQgPT4ge1xuICAgICAgICAgICAgICAgICAgICBjb25zdCBzcG9vbCA9IGF0dGFjaG1lbnQuZW50aXR5LnNwb29sO1xuICAgICAgICAgICAgICAgICAgICBpZiAoc3Bvb2wudHlwZSA9PSBOb2RlVHlwZS5pc29sYXRvcikge1xuICAgICAgICAgICAgICAgICAgICAgICAgaXNJc29sYXRlZCA9ICFpc0lzb2xhdGVkO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIGF0dGFjaG1lbnQuaXNvbGF0ZWQgPSBpc0lzb2xhdGVkO1xuICAgICAgICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgICAgICAgLy8gY2hlY2sgbGluZSBvdmVybGFwXG4gICAgICAgICAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBhdHRhY2htZW50cy5sZW5ndGggLSAxOyBpKyspIHtcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgYTEgPSBhdHRhY2htZW50c1tpXTtcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgYjEgPSBhdHRhY2htZW50c1tpICsgMV07XG4gICAgICAgICAgICAgICAgICAgIGlmIChhMS5pc29sYXRlZCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgY29udGludWU7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgZm9yIChsZXQgaiA9IDA7IGogPCBhdHRhY2htZW50cy5sZW5ndGggLSAxOyBqKyspIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IGEyID0gYXR0YWNobWVudHNbal07XG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBiMiA9IGF0dGFjaG1lbnRzW2ogKyAxXTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChhMi5pc29sYXRlZCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGxpbmVMaW5lSW50ZXJzZWN0KGExLm91dFBvcyEsIGIxLmluUG9zISwgYTIub3V0UG9zISwgYjIuaW5Qb3MhKSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGExLm92ZXJsYXAgPSBhMi5vdmVybGFwID0gdHJ1ZTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIC8vIGNoZWNrIGJsb2NrIGNvbGxpc2lvblxuICAgICAgICAgICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgYXR0YWNobWVudHMubGVuZ3RoIC0gMTsgaSsrKSB7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IGExID0gYXR0YWNobWVudHNbaV07XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IGIxID0gYXR0YWNobWVudHNbaSArIDFdO1xuICAgICAgICAgICAgICAgICAgICBmb3IgKGxldCBqID0gMDsgaiA8IGJsb2NrRW50aXRpZXMubGVuZ3RoOyBqKyspIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChsaW5lQ2lyY2xlSW50ZXJzZWN0KGExLm91dFBvcyEsIGIxLmluUG9zISwgYmxvY2tFbnRpdGllc1tqXS5wb3MsIGJsb2NrRW50aXRpZXNbal0uYmxvY2suc2l6ZSkpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBhMS5vdmVybGFwID0gdHJ1ZTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjYWJsZS5jYWJsZS5vdmVycG93ZXJlZCA9IHRydWU7XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgLy8gY2hlY2sgcG93ZXIgLyBvdmVycG93ZXJcbiAgICAgICAgICAgICAgICBsZXQgaGFzUG93ZXIgPSB0cnVlO1xuICAgICAgICAgICAgICAgIGNhYmxlLmNhYmxlLmF0dGFjaG1lbnRzLmV2ZXJ5KGF0dGFjaG1lbnQgPT4ge1xuICAgICAgICAgICAgICAgICAgICBpZiAoIWhhc1Bvd2VyKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgaWYgKGF0dGFjaG1lbnQuaXNvbGF0ZWQgJiYgIWF0dGFjaG1lbnQub3ZlcmxhcCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgaWYgKGF0dGFjaG1lbnQuZW50aXR5LnNwb29sLnBvd2VyZWQpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGF0dGFjaG1lbnQuZW50aXR5LnNwb29sLm92ZXJwb3dlcmVkID0gdHJ1ZTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNhYmxlLmNhYmxlLm92ZXJwb3dlcmVkID0gdHJ1ZTtcbiAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgICAgIGF0dGFjaG1lbnQuZW50aXR5LnNwb29sLnBvd2VyZWQgPSB0cnVlO1xuXG4gICAgICAgICAgICAgICAgICAgIGlmIChhdHRhY2htZW50Lm92ZXJsYXApIHtcblxuICAgICAgICAgICAgICAgICAgICAgICAgaGFzUG93ZXIgPSBmYWxzZTtcbiAgICAgICAgICAgICAgICAgICAgfSBlbHNlIGlmIChhdHRhY2htZW50LmVudGl0eS5zcG9vbC50eXBlID09IE5vZGVUeXBlLnNwb29sKXtcblxuICAgICAgICAgICAgICAgICAgICAgICAgbnVtUG93ZXJlZFNwb29scysrO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgICAgICAgLy8gY2hlY2sgaWYgbGV2ZWwgaXMgY29tcGxldGVkXG4gICAgICAgICAgICAgICAgaWYgKGhhc1Bvd2VyICYmIGZpbmlzaEVudGl0eS5maW5pc2guY29ubmVjdGVkICYmICFjYWJsZS5jYWJsZS5vdmVycG93ZXJlZCAmJiBudW1Qb3dlcmVkU3Bvb2xzID09PSBudW1TcG9vbHMpIHtcbiAgICAgICAgICAgICAgICAgICAgb25MZXZlbENvbXBsZXRlZCgpO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIGlmIChudW1Qb3dlcmVkU3Bvb2xzICE9IGxhc3RQb3dlcmVkU3Bvb2xzKSB7XG4gICAgICAgICAgICAgICAgICAgIG5vZGVJbmZvLmlubmVySFRNTCA9IG51bVBvd2VyZWRTcG9vbHMgKyAnIC8gJyArIG51bVNwb29scztcbiAgICAgICAgICAgICAgICB9XG5cblxuICAgICAgICAgICAgICAgIGxhc3RQb3dlcmVkU3Bvb2xzID0gbnVtUG93ZXJlZFNwb29scztcblxuICAgICAgICAgICAgfSk7XG4gICAgICAgIH1cbiAgICB9O1xufTtcbiIsInR5cGUgQ2FudmFzID0gSFRNTENhbnZhc0VsZW1lbnQ7XG50eXBlIENvbnRleHQgPSBDYW52YXNSZW5kZXJpbmdDb250ZXh0MkQ7XG50eXBlIEZpbGxTdHlsZSA9IHN0cmluZyB8IENhbnZhc0dyYWRpZW50IHwgQ2FudmFzUGF0dGVybjtcbnR5cGUgU3Ryb2tlU3R5bGUgPSBzdHJpbmcgfCBDYW52YXNHcmFkaWVudCB8IENhbnZhc1BhdHRlcm5cblxuZW51bSBTaWRlIHtsZWZ0ID0gLTEsIHJpZ2h0ID0gMX1cblxuZW51bSBOb2RlVHlwZSB7XG4gICAgc3Bvb2wsIHN0YXJ0LCBlbmQsIGJsb2NrLCBmaW5pc2gsIGlzb2xhdG9yXG59XG5cbmludGVyZmFjZSBHYW1lT2JqZWN0IHtcblxufVxuXG50eXBlIENvbG9yID0geyByOiBudW1iZXIsIGc6IG51bWJlciwgYjogbnVtYmVyLCBhOiBudW1iZXIgfVxuXG5pbnRlcmZhY2UgQ29ubmVjdG9yIHtcbiAgICBwb3M6IFZlYzI7XG4gICAgc2l6ZTogbnVtYmVyO1xufVxuXG50eXBlIEFjdGl2YXRhYmxlID0gQ29ubmVjdG9yICYge1xuICAgIGFjdGl2ZT86IGJvb2xlYW47XG59XG5cbnR5cGUgSGFzUG9zaXRpb24gPSB7IHBvczogVmVjMjsgfVxuXG50eXBlIFNwb29sID0gSGFzUG9zaXRpb24gJiB7IHNpemU6IG51bWJlcjsgfVxuLy8gaW50ZXJmYWNlIFNwb29sIGV4dGVuZHMgIENvbm5lY3RvciB7XG4vLyAgICAgaG92ZXI/OiBib29sZWFuO1xuLy8gfVxuXG50eXBlIFZlYzIgPSB7XG4gICAgeDogbnVtYmVyO1xuICAgIHk6IG51bWJlcjtcbn07XG5cbnR5cGUgUG9zaXRpb25Db21wb25lbnQgPSB7XG4gICAgcG9zOiBWZWMyO1xufVxuXG50eXBlIFNwb29sQ29tcG9uZW50ID0ge1xuICAgIHR5cGU6IE5vZGVUeXBlO1xuICAgIHNpemU6IG51bWJlcjtcbiAgICBpc0F0dGFjaGVkPzpib29sZWFuO1xuICAgIHBvd2VyZWQ/OiBib29sZWFuO1xuICAgIG92ZXJwb3dlcmVkPzogYm9vbGVhbjtcbn1cblxudHlwZSBCbG9ja0NvbXBvbmVudCA9IHtcbiAgICBzaXplOiBudW1iZXI7XG59XG50eXBlIElzb2xhdG9yQ29tcG9uZW50ID0ge1xuICAgIHNpemU6IG51bWJlcjtcbn1cblxudHlwZSBSZW5kZXJDb21wb25lbnQgPSB7XG4gICAgdHlwZTogTm9kZVR5cGVcbiAgICBob3Zlcj86IGJvb2xlYW5cbn1cbnR5cGUgSW5wdXRDb21wb25lbnQgPSB7XG4gICAgaW5wdXRTaXplOiBudW1iZXJcbn1cbnR5cGUgQXR0YWNobWVudCA9IHsgZW50aXR5OiBTcG9vbEVudGl0eSwgc2lkZTogU2lkZTsgaW5Qb3M/OiBWZWMyLCBvdXRQb3M/OiBWZWMyLCBpc29sYXRlZD86Ym9vbGVhbiwgb3ZlcmxhcD86Ym9vbGVhbiB9XG50eXBlIE1vdXNlRHJhZ0NvbXBvbmVudCA9IHsgc2l6ZTogbnVtYmVyIH07XG50eXBlIENhYmxlQ29tcG9uZW50ID0ge1xuICAgIGF0dGFjaG1lbnRzOiBBdHRhY2htZW50W107XG4gICAgb3ZlcnBvd2VyZWQ/OiBib29sZWFuO1xufVxuXG50eXBlIEZpbmlzaENvbXBvbmVudCA9IHsgY29ubmVjdGVkPzogYm9vbGVhbiB9O1xudHlwZSBFbnRpdHkgPSB7XG4gICAgcG9zOiBWZWMyO1xuICAgIHNwb29sOiBTcG9vbENvbXBvbmVudDtcbiAgICBibG9jazogQmxvY2tDb21wb25lbnQ7XG4gICAgaW5wdXQ6IElucHV0Q29tcG9uZW50O1xuICAgIHJlbmRlcjogUmVuZGVyQ29tcG9uZW50O1xuICAgIGlzb2xhdG9yOiBJc29sYXRvckNvbXBvbmVudDtcbiAgICBjYWJsZTogQ2FibGVDb21wb25lbnQ7XG4gICAgbW91c2VEcmFnOiBNb3VzZURyYWdDb21wb25lbnQ7XG4gICAgZmluaXNoOiBGaW5pc2hDb21wb25lbnQ7XG4gICAgLy8gc3RhcnROb2RlPzogRW5kTm9kZTtcbiAgICAvLyBFbmROb2RlTm9kZT86IEVuZE5vZGU7XG59XG5cbnR5cGUgU3Bvb2xFbnRpdHkgPSBQaWNrPEVudGl0eSwgJ3BvcycgfCAnc3Bvb2wnPjtcbnR5cGUgU3Bvb2xOb2RlRW50aXR5ID0gUGljazxFbnRpdHksICdyZW5kZXInPiAmIFNwb29sRW50aXR5O1xudHlwZSBTdGFydE5vZGVFbnRpdHkgPSBQaWNrPEVudGl0eSwgJ3BvcycgfCAnc3Bvb2wnIHwgJ3JlbmRlcic+O1xudHlwZSBFbmROb2RlRW50aXR5ID0gUGljazxFbnRpdHksICdwb3MnIHwgJ3Nwb29sJyB8ICdyZW5kZXInIHwgJ21vdXNlRHJhZyc+O1xudHlwZSBDYWJsZUVudGl0eSA9IFBpY2s8RW50aXR5LCAnY2FibGUnPjtcbnR5cGUgUmVuZGVyRW50aXR5ID0gUGljazxFbnRpdHksICdyZW5kZXInPjtcbnR5cGUgTW91c2VEcmFnRW50aXR5ID0gUGljazxFbnRpdHksICdtb3VzZURyYWcnIHwgJ3Bvcyc+O1xudHlwZSBGaW5pc2hFbnRpdHkgPSBQaWNrPEVudGl0eSwgJ2ZpbmlzaCcgfCAncmVuZGVyJyB8ICdwb3MnPjtcbnR5cGUgQmxvY2tFbnRpdHkgPSBQaWNrPEVudGl0eSwgJ2Jsb2NrJyB8ICdwb3MnPjtcbnR5cGUgQmxvY2tOb2RlRW50aXR5ID0gUGljazxFbnRpdHksICdyZW5kZXInPiAmIEJsb2NrRW50aXR5O1xudHlwZSBJc29sYXRvckVudGl0eSA9IFBpY2s8RW50aXR5LCAncG9zJyB8ICdyZW5kZXInIHwgJ2lzb2xhdG9yJyA+O1xuXG4vLyBUT0RPOiBkbyBpIG5lZWQgdG8gZGlmZmVyZW50aWF0ZSBiZXR3ZWVuIE5vZGVFbnRpdHkgYW5kIEVudGl0eT8hIGRvbid0IHRoaW5rIHNvLCByZW1vdmUgTm9kZUVudGl0eVxuXG4vKlxuICAgIFN0YXJ0XG4gICAgICAgIEhhc1Bvc2l0aW9uXG4gICAgICAgIFN0YXJ0Tm9kZVxuICAgICAgICBTcG9vbFxuICAgIEVuZFxuICAgICAgICBIYXNQb3NpdGlvblxuICAgICAgICBTcG9vbFxuICAgICAgICBNb3VzZUV2ZW50c1xuICAgICAgICBEcmFnQ29ubmVjdG9yXG4gICAgIEZpbmlzaFxuICAgICAgICBIYXNQb3NpdGlvblxuICAgICAgICBGaW5pc2hOb2RlXG4gICAgIFNwb29sXG4gICAgICAgIEhhc1Bvc2l0aW9uXG4gICAgICAgIFNwb29sXG5cblxuXG4gKi9cblxuIiwiY29uc3QgbmV4dEZyYW1lID0gcmVxdWVzdEFuaW1hdGlvbkZyYW1lO1xuY29uc3Qgc3RhcnRGcmFtZUxvb3AgPSAoY2FsbGJhY2s6ICh0aW1lOiBudW1iZXIpID0+IHZvaWQgKSA9PiB7XG5cbiAgICBsZXQgcmVxdWVzdElkOiBudW1iZXI7XG4gICAgbGV0IHN0b3BMb29wOmJvb2xlYW4gPSBmYWxzZTtcbiAgICBsZXQgbGFzdFRpbWUgPSAwO1xuICAgIGNvbnN0IHVwZGF0ZSA9ICh0aW1lOiBudW1iZXIpID0+IHtcbiAgICAgICAgY2FsbGJhY2sodGltZSAqIDAuMDAxKTtcbiAgICAgICAgaWYgKCFzdG9wTG9vcCkge1xuICAgICAgICAgICAgcmVxdWVzdElkID0gbmV4dEZyYW1lKHVwZGF0ZSk7XG4gICAgICAgIH1cbiAgICAgICAgbGFzdFRpbWUgPSB0aW1lO1xuICAgIH07XG4gICAgcmVxdWVzdElkPSBuZXh0RnJhbWUodXBkYXRlKTtcblxuICAgIHJldHVybiAoKSA9PiB7XG4gICAgICAgIHN0b3BMb29wID0gdHJ1ZTtcbiAgICB9O1xufTtcblxuY29uc3QgdHdlZW4gPSAoZnJvbTogbnVtYmVyLCB0bzogbnVtYmVyLCBkdXJhdGlvbjpudW1iZXIsIG9uVXBkYXRlOiAodDogbnVtYmVyKSA9PiB2b2lkLCBvbkNvbXBsZXRlOiAoKSA9PiB2b2lkKSA9PiB7XG4gICAgY29uc3Qgc3RhcnRUaW1lID0gcGVyZm9ybWFuY2Uubm93KCk7XG4gICAgY29uc3QgdXBkYXRlID0gKHRpbWU6IG51bWJlcikgPT4ge1xuICAgICAgICBsZXQgdCA9IDEvZHVyYXRpb24gKiAodGltZS1zdGFydFRpbWUpKjAuMDAxO1xuICAgICAgICBpZiAodCA8IDEpIHtcbiAgICAgICAgICAgIG9uVXBkYXRlKGZyb20rKHRvLWZyb20pKnQpO1xuICAgICAgICAgICAgbmV4dEZyYW1lKHVwZGF0ZSk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBvblVwZGF0ZSh0byk7XG4gICAgICAgICAgICBuZXh0RnJhbWUob25Db21wbGV0ZSk7XG4gICAgICAgIH1cbiAgICB9O1xuICAgIHVwZGF0ZShzdGFydFRpbWUpO1xufTtcbiIsIi8vLyA8cmVmZXJlbmNlIHBhdGg9XCJ0eXBlcy50c1wiIC8+XG4vLy8gPHJlZmVyZW5jZSBwYXRoPVwidXRpbHMudHNcIiAvPlxuLy8vIDxyZWZlcmVuY2UgcGF0aD1cIm1hdGgtdXRpbC50c1wiIC8+XG4vLy8gPHJlZmVyZW5jZSBwYXRoPVwiaHRtbC50c1wiIC8+XG4vLy8gPHJlZmVyZW5jZSBwYXRoPVwicmVzb3VyY2VzLnRzXCIgLz5cbi8vLyA8cmVmZXJlbmNlIHBhdGg9XCJnYW1lLnRzXCIgLz5cblxuY29uc3Qgc2hvd0VuZFNjcmVlbiA9ICgpID0+IHtcbiAgICBuZXh0TXNnLmlubmVySFRNTCA9ICdUaGFua3MgZm9yIHBsYXlpbmchJztcbiAgICBuZXh0QnRuLmlubmVySFRNTCA9ICdBR0FJTic7XG4gICAgc2hvd0VsZW1lbnQobGV2ZWxEb25lRWxlbWVudCwgKCkgPT4ge1xuICAgICAgICBuZXh0QnRuLmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgZSA9PiB7XG4gICAgICAgICAgICBsb2NhdGlvbi5yZWxvYWQoKTtcbiAgICAgICAgfSk7XG4gICAgfSk7XG4gICAgc2F2ZUxldmVsKDApO1xufTtcblxuY29uc3Qgc3RhcnRHYW1lID0gKHBhcmVudDogSFRNTEVsZW1lbnQsIHJlc291cmNlczogUmVzb3VyY2VzLCBzdGFydExldmVsOiBudW1iZXIpID0+IHtcbiAgICBjb25zdCBnYW1lID0gY3JlYXRlR2FtZSgpO1xuICAgIGxldCBjdXJyZW50TGV2ZWwgPSBzdGFydExldmVsO1xuXG4gICAgY29uc3Qgc3RhcnROZXh0TGV2ZWwgPSAoKSA9PiB7XG4gICAgICAgIGNvbnNvbGUubG9nKCdzdGFydCBsZXZlbCAnICsgY3VycmVudExldmVsKTtcblxuICAgICAgICBsZXQgdHV0b3JpYWw6IEhUTUxFbGVtZW50O1xuICAgICAgICBpZiAoY3VycmVudExldmVsID09IDApIHtcbiAgICAgICAgICAgIHR1dG9yaWFsID0gcmVzb3VyY2VzLnR1dG9yaWFsMTtcbiAgICAgICAgICAgIGdhbWVFbGVtZW50LmFwcGVuZENoaWxkKHR1dG9yaWFsKTtcbiAgICAgICAgICAgIHNob3dFbGVtZW50KHR1dG9yaWFsKTtcbiAgICAgICAgfVxuICAgICAgICBpZiAoY3VycmVudExldmVsID09IDIpIHtcbiAgICAgICAgICAgIHR1dG9yaWFsID0gcmVzb3VyY2VzLnR1dG9yaWFsMjtcbiAgICAgICAgICAgIGdhbWVFbGVtZW50LmFwcGVuZENoaWxkKHR1dG9yaWFsKTtcbiAgICAgICAgICAgIHNob3dFbGVtZW50KHR1dG9yaWFsKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGNvbnN0IGxldmVsID0gZ2FtZS5jcmVhdGVMZXZlbChnYW1lRGF0YS5sZXZlbHNbY3VycmVudExldmVsXSwgcmVzb3VyY2VzLCAoKSA9PiB7XG4gICAgICAgICAgICBpZiAodHV0b3JpYWwpIHtcbiAgICAgICAgICAgICAgICBoaWRlRWxlbWVudCh0dXRvcmlhbCwgKCkgPT4ge1xuICAgICAgICAgICAgICAgICAgICByZW1vdmVFbGVtZW50KHR1dG9yaWFsKTtcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGlmIChjdXJyZW50TGV2ZWwgPCBnYW1lRGF0YS5sZXZlbHMubGVuZ3RoIC0gMSkge1xuICAgICAgICAgICAgICAgIGN1cnJlbnRMZXZlbCsrO1xuICAgICAgICAgICAgICAgIHNhdmVMZXZlbChjdXJyZW50TGV2ZWwpO1xuICAgICAgICAgICAgICAgIGhpZGVFbGVtZW50KHJlc2V0RWxlbWVudCk7XG4gICAgICAgICAgICAgICAgc2hvd0VsZW1lbnQoW2xldmVsRG9uZUVsZW1lbnRdLCAoKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgIG5leHRCdG4ub25jbGljayA9ICgpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgICAgIG5leHRCdG4ub25jbGljayA9IG51bGw7XG4gICAgICAgICAgICAgICAgICAgICAgICBoaWRlRWxlbWVudChbbGV2ZWxEb25lRWxlbWVudCwgbGV2ZWwuY2FudmFzLCBsZXZlbEluZm8sIG5vZGVJbmZvXSwgKCkgPT4ge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJlbW92ZUVsZW1lbnQobGV2ZWwuY2FudmFzKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBzdGFydE5leHRMZXZlbCgpO1xuICAgICAgICAgICAgICAgICAgICAgICAgfSk7XG5cbiAgICAgICAgICAgICAgICAgICAgfTtcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgc2hvd0VuZFNjcmVlbigpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9KTtcblxuICAgICAgICBwYXJlbnQuYXBwZW5kQ2hpbGQobGV2ZWwuY2FudmFzKTtcbiAgICAgICAgbGV2ZWxJbmZvLmlubmVySFRNTCA9ICdMZXZlbCAnICsgKGN1cnJlbnRMZXZlbCArIDEpO1xuICAgICAgICBzaG93RWxlbWVudChbbGV2ZWwuY2FudmFzLCByZXNldEVsZW1lbnQsIGxldmVsSW5mbywgbm9kZUluZm9dKTtcblxuICAgICAgICBjb25zdCByZXNldExldmVsID0gKCkgPT4ge1xuICAgICAgICAgICAgaWYgKHR1dG9yaWFsKSB7XG4gICAgICAgICAgICAgICAgaGlkZUVsZW1lbnQodHV0b3JpYWwsICgpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgcmVtb3ZlRWxlbWVudCh0dXRvcmlhbCk7XG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBiYWNrQnRuLm9uY2xpY2sgPSBza2lwQnRuLm9uY2xpY2sgPSByZXNldEJ0bi5vbmNsaWNrID0gbnVsbDtcbiAgICAgICAgICAgIGhpZGVFbGVtZW50KFtsZXZlbC5jYW52YXMsIHJlc2V0RWxlbWVudCwgbGV2ZWxJbmZvLCBub2RlSW5mb10sICgpID0+IHtcbiAgICAgICAgICAgICAgICBsZXZlbC5zaHV0ZG93bigpO1xuICAgICAgICAgICAgICAgIHJlbW92ZUVsZW1lbnQobGV2ZWwuY2FudmFzKTtcbiAgICAgICAgICAgICAgICBzdGFydE5leHRMZXZlbCgpO1xuICAgICAgICAgICAgfSk7XG5cbiAgICAgICAgfTtcblxuICAgICAgICByZXNldEJ0bi5vbmNsaWNrID0gcmVzZXRMZXZlbDtcbiAgICAgICAgc2tpcEJ0bi5vbmNsaWNrID0gKCkgPT4ge1xuICAgICAgICAgICAgaWYgKGN1cnJlbnRMZXZlbCA+IGdhbWVEYXRhLmxldmVscy5sZW5ndGggLSAyKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgY3VycmVudExldmVsKys7XG4gICAgICAgICAgICByZXNldExldmVsKCk7XG4gICAgICAgIH07XG4gICAgICAgIGJhY2tCdG4ub25jbGljayA9ICgpID0+IHtcbiAgICAgICAgICAgIGlmIChjdXJyZW50TGV2ZWwgPCAxKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgY3VycmVudExldmVsLS07XG4gICAgICAgICAgICByZXNldExldmVsKCk7XG4gICAgICAgIH07XG4gICAgfTtcblxuICAgIHN0YXJ0TmV4dExldmVsKCk7XG59O1xuXG5jb25zdCBwcmVwYXJlR2FtZSA9ICgpID0+IHtcbiAgICBjb25zdCBbbG9hZGluZ0JhciwgY29udGV4dF0gPSBjcmVhdGVDYW52YXMoMjAwLCA3KTtcbiAgICBsb2FkaW5nQmFyLmlkID0gJ2xvYWRpbmdiYXInO1xuICAgIGxvYWRpbmdFbGVtZW50LmFwcGVuZENoaWxkKGxvYWRpbmdCYXIpO1xuICAgIHNob3dFbGVtZW50KGxvYWRpbmdCYXIpO1xuICAgIGNvbnRleHQuc3Ryb2tlU3R5bGUgPSAnZ3JleSc7XG4gICAgY29udGV4dC5maWxsU3R5bGUgPSAnZ3JleSc7XG4gICAgY29udGV4dC5saW5lV2lkdGggPSAxO1xuXG4gICAgY29udGV4dC5zdHJva2VSZWN0KDAuNSwgMC41LCAxOTksIDQpO1xuICAgIGdlbmVyYXRlUmVzb3VyY2VzKHAgPT4ge1xuICAgICAgICBjb250ZXh0LmZpbGxSZWN0KDAuNSwgMC41LCAxOTkgLyAxMDAgKiBwLCA0KTtcbiAgICB9LCAocmVzb3VyY2VzKSA9PiB7XG5cbiAgICAgICAgaGlkZUVsZW1lbnQobG9hZGluZ0JhciwgKCkgPT4ge1xuICAgICAgICAgICAgc2hvd0VsZW1lbnQoW21lbnVFbGVtZW50LCBkZXNjcmlwdGlvbkVsZW1lbnRdKTtcblxuICAgICAgICAgICAgY29uc3Qgc2F2ZWRMZXZlbCA9IGxvYWRMZXZlbCgpO1xuICAgICAgICAgICAgY29udGludWVCdG4uc3R5bGUudmlzaWJpbGl0eSA9IHNhdmVkTGV2ZWwgPyAndmlzaWJsZScgOiAnaGlkZGVuJztcblxuICAgICAgICAgICAgY29uc3QgaGlkZVVJYW5kU3RhcnRHYW1lID0gKHN0YXJ0TGV2ZWw6IG51bWJlcikgPT4ge1xuICAgICAgICAgICAgICAgIHN0YXJ0QnRuLm9uY2xpY2sgPSBjb250aW51ZUJ0bi5vbmNsaWNrID0gbnVsbDtcbiAgICAgICAgICAgICAgICBoaWRlRWxlbWVudChbdGl0bGVFbGVtZW50LCBtZW51RWxlbWVudCwgZGVzY3JpcHRpb25FbGVtZW50XSwgKCkgPT4ge1xuICAgICAgICAgICAgICAgICAgICBzdGFydEdhbWUoY29udGVudEVsZW1lbnQsIHJlc291cmNlcywgc3RhcnRMZXZlbCk7XG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICB9O1xuICAgICAgICAgICAgc3RhcnRCdG4ub25jbGljayA9ICgpID0+IHtcbiAgICAgICAgICAgICAgICBzYXZlTGV2ZWwoMCk7XG4gICAgICAgICAgICAgICAgaGlkZVVJYW5kU3RhcnRHYW1lKDApO1xuICAgICAgICAgICAgfTtcblxuICAgICAgICAgICAgY29udGludWVCdG4ub25jbGljayA9ICgpID0+IHtcbiAgICAgICAgICAgICAgICBoaWRlVUlhbmRTdGFydEdhbWUoc2F2ZWRMZXZlbCk7XG4gICAgICAgICAgICB9O1xuXG4gICAgICAgICAgICAvLyBoaWRlVUlhbmRTdGFydEdhbWUoMTApOyAvLyBza2lwIG1haW4gbWVudSBhbmQgc3RhcnQgd2l0aCBsZXZlbFxuICAgICAgICB9KTtcblxuICAgIH0pO1xufTtcblxuc2hvd0VsZW1lbnQodGl0bGVFbGVtZW50LCBwcmVwYXJlR2FtZSk7XG4iXX0=