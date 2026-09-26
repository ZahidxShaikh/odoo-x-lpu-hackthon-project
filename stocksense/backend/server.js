import "dotenv/config";
import express from "express";
import cookieParser from "cookie-parser";
import { PrismaClient } from "@prisma/client";
import { auth, createAuthRouter } from "./auth-routes.js";
import { isEmailConfigured } from "./email.js";

const app = express();
const prisma = new PrismaClient();
const PORT = Number(process.env.PORT || 4000);

if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is missing in .env");
if (!process.env.SESSION_SECRET || process.env.SESSION_SECRET.length < 32) {
    throw new Error("SESSION_SECRET must be set to a random value of at least 32 characters.");
}

app.use(express.json({ limit: "32kb" }));
app.use(cookieParser());
app.use("/api/auth", createAuthRouter(prisma));

if (!isEmailConfigured()) {
    console.warn("Gmail is not configured; signup verification and password reset emails are disabled.");
}

function dateOnly(value) {
    if (!value) return "";
    return new Date(value).toISOString().slice(0, 10);
}

async function defaultLocation(tx, userId) {
    const location = await tx.location.findFirst({
        where: { warehouse: { userId } },
        orderBy: { createdAt: "asc" },
    });
    if (!location) throw new Error("Create a warehouse and location first.");
    return location;
}

async function findLocation(tx, userId, value) {
    if (!value) return null;

    const byId = await tx.location.findFirst({
        where: { id: value, warehouse: { userId } },
    });
    if (byId) return byId;

    return tx.location.findFirst({
        where: {
            name: { equals: value, mode: "insensitive" },
            warehouse: { userId },
        },
    });
}

async function productJson(product) {
    const stockLevels = await prisma.stockLevel.findMany({
        where: { productId: product.id },
    });
    const onHand = stockLevels.reduce((sum, row) => sum + row.onHand, 0);
    const allocated = stockLevels.reduce((sum, row) => sum + row.allocated, 0);

    return {
        id: product.id,
        name: product.name,
        sku: product.sku,
        category: product.category,
        unitOfMeasure: product.unitOfMeasure,
        unitCost: Number(product.unitCost),
        reorderLevel: product.reorderLevel,
        onHand,
        allocated,
    };
}

async function resolveLines(tx, userId, inputLines = []) {
    if (!Array.isArray(inputLines) || inputLines.length === 0) {
        throw new Error("Add at least one product line.");
    }

    const lines = [];
    for (const line of inputLines) {
        const quantity = Number(line.quantity);
        if (!Number.isInteger(quantity) || quantity <= 0) {
            throw new Error("Each operation quantity must be a positive whole number.");
        }

        const search = line.productId || line.productName?.trim();
        if (!search) throw new Error("Choose a product for every line.");

        const product = await tx.product.findFirst({
            where: {
                userId,
                OR: [
                    { id: search },
                    { sku: { equals: search, mode: "insensitive" } },
                    { name: { equals: search, mode: "insensitive" } },
                ],
            },
        });
        if (!product) throw new Error(`Product not found: ${search}`);

        lines.push({ productId: product.id, quantity });
    }
    return lines;
}

async function operationJson(operation) {
    const full = await prisma.operation.findUnique({
        where: { id: operation.id },
        include: { lines: { include: { product: true } } },
    });

    return {
        id: full.id,
        reference: full.reference,
        type: full.type,
        status: full.status,
        contact: full.contact,
        scheduledDate: dateOnly(full.scheduledDate),
        fromLocationId: full.fromLocationId || "",
        toLocationId: full.toLocationId || "",
        lines: full.lines.map((line) => ({
            id: line.id,
            productId: line.productId,
            productName: line.product.name,
            quantity: line.quantity,
        })),
    };
}

async function applyOperation(tx, operation, userId) {
    for (const line of operation.lines) {
        const product = await tx.product.findFirst({
            where: { id: line.productId, userId },
        });
        if (!product) throw new Error("An operation product no longer exists.");

        let fromLocation = await findLocation(tx, userId, operation.fromLocationId);
        let toLocation = await findLocation(tx, userId, operation.toLocationId);

        if (operation.type === "RECEIPT") {
            toLocation ||= await defaultLocation(tx, userId);
            await tx.stockLevel.upsert({
                where: { productId_locationId: { productId: product.id, locationId: toLocation.id } },
                create: { productId: product.id, locationId: toLocation.id, onHand: line.quantity },
                update: { onHand: { increment: line.quantity } },
            });
        } else if (operation.type === "DELIVERY") {
            let level;
            if (fromLocation) {
                level = await tx.stockLevel.findUnique({
                    where: { productId_locationId: { productId: product.id, locationId: fromLocation.id } },
                });
            } else {
                level = await tx.stockLevel.findFirst({
                    where: { productId: product.id, onHand: { gte: line.quantity } },
                    include: { location: true },
                });
                if (level) fromLocation = level.location;
            }
            if (!level || level.onHand < line.quantity) {
                throw new Error(`Not enough stock for ${product.name}.`);
            }
            await tx.stockLevel.update({
                where: { id: level.id },
                data: { onHand: { decrement: line.quantity } },
            });
        } else if (operation.type === "INTERNAL") {
            if (!fromLocation || !toLocation) {
                throw new Error("Select valid source and destination locations for the transfer.");
            }
            const level = await tx.stockLevel.findUnique({
                where: { productId_locationId: { productId: product.id, locationId: fromLocation.id } },
            });
            if (!level || level.onHand < line.quantity) {
                throw new Error(`Not enough stock at the source location for ${product.name}.`);
            }
            await tx.stockLevel.update({
                where: { id: level.id },
                data: { onHand: { decrement: line.quantity } },
            });
            await tx.stockLevel.upsert({
                where: { productId_locationId: { productId: product.id, locationId: toLocation.id } },
                create: { productId: product.id, locationId: toLocation.id, onHand: line.quantity },
                update: { onHand: { increment: line.quantity } },
            });
        }

        await tx.stockMove.create({
            data: {
                userId,
                operationId: operation.id,
                reference: operation.reference,
                productId: product.id,
                type: operation.type,
                status: "DONE",
                contact: operation.contact,
                fromLocationId: fromLocation?.id,
                toLocationId: toLocation?.id,
                quantity: line.quantity,
            },
        });
    }
}

/* Dashboard */

app.get("/api/dashboard/kpis", auth, async (req, res) => {
    const userId = req.userId;
    const [products, operations, warehouses, categories] = await Promise.all([
        prisma.product.findMany({ where: { userId }, include: { stockLevels: true } }),
        prisma.operation.findMany({ where: { userId } }),
        prisma.warehouse.findMany({ where: { userId }, include: { locations: true } }),
        prisma.product.findMany({ where: { userId }, select: { category: true }, distinct: ["category"] }),
    ]);

    const productRows = products.map((p) => ({
        ...p,
        total: p.stockLevels.reduce((sum, row) => sum + row.onHand, 0),
    }));

    res.json({
        totalProducts: productRows.filter((p) => p.total > 0).length,
        lowStock: productRows.filter((p) => p.total <= p.reorderLevel).length,
        pendingReceipts: operations.filter((o) => o.type === "RECEIPT" && ["DRAFT", "WAITING", "READY"].includes(o.status)).length,
        pendingDeliveries: operations.filter((o) => o.type === "DELIVERY" && ["DRAFT", "WAITING", "READY"].includes(o.status)).length,
        scheduledTransfers: operations.filter((o) => o.type === "INTERNAL" && ["DRAFT", "WAITING", "READY"].includes(o.status)).length,
        locations: warehouses.flatMap((w) => w.locations.map((l) => ({ id: l.id, name: `${w.name} / ${l.name}` }))),
        categories: categories.map((row) => row.category),
    });
});

/* Products */

app.get("/api/products", auth, async (req, res) => {
    const products = await prisma.product.findMany({
        where: { userId: req.userId },
        include: { stockLevels: true },
        orderBy: { name: "asc" },
    });
    res.json(await Promise.all(products.map(productJson)));
});

app.post("/api/products", auth, async (req, res) => {
    const { name, sku, category, unitOfMeasure, unitCost, reorderLevel, initialStock } = req.body || {};
    if (!name || !sku || !category || !unitOfMeasure) {
        return res.status(400).json({ error: "Name, SKU, category, and unit are required." });
    }

    try {
        const result = await prisma.$transaction(async (tx) => {
            const location = await defaultLocation(tx, req.userId);
            const product = await tx.product.create({
                data: {
                    userId: req.userId,
                    name,
                    sku,
                    category,
                    unitOfMeasure,
                    unitCost: Number(unitCost || 0),
                    reorderLevel: Number(reorderLevel || 0),
                },
            });

            const quantity = Number(initialStock || 0);
            if (quantity > 0) {
                await tx.stockLevel.create({
                    data: { productId: product.id, locationId: location.id, onHand: quantity },
                });
                await tx.stockMove.create({
                    data: {
                        userId: req.userId,
                        reference: "OPENING-STOCK",
                        productId: product.id,
                        type: "RECEIPT",
                        quantity,
                        toLocationId: location.id,
                        contact: "Opening stock",
                    },
                });
            }
            return product;
        });

        res.status(201).json(await productJson(result));
    } catch (error) {
        res.status(400).json({ error: error.code === "P2002" ? "That SKU already exists." : error.message });
    }
});

app.put("/api/products/:id", auth, async (req, res) => {
    const existing = await prisma.product.findFirst({ where: { id: req.params.id, userId: req.userId } });
    if (!existing) return res.status(404).json({ error: "Product not found." });

    const { name, sku, category, unitOfMeasure, unitCost, reorderLevel } = req.body || {};
    try {
        const product = await prisma.product.update({
            where: { id: existing.id },
            data: {
                name,
                sku,
                category,
                unitOfMeasure,
                unitCost: unitCost === "" || unitCost == null ? undefined : Number(unitCost),
                reorderLevel: reorderLevel == null ? undefined : Number(reorderLevel),
            },
        });
        res.json(await productJson(product));
    } catch (error) {
        res.status(400).json({ error: error.code === "P2002" ? "That SKU already exists." : error.message });
    }
});

app.get("/api/products/:id/stock-by-location", auth, async (req, res) => {
    const product = await prisma.product.findFirst({ where: { id: req.params.id, userId: req.userId } });
    if (!product) return res.status(404).json({ error: "Product not found." });

    const levels = await prisma.stockLevel.findMany({
        where: { productId: product.id },
        include: { location: { include: { warehouse: true } } },
    });
    res.json(levels.map((row) => ({
        locationId: row.locationId,
        warehouseName: row.location.warehouse.name,
        locationName: row.location.name,
        onHand: row.onHand,
    })));
});

/* Warehouses and locations */

app.get("/api/warehouses", auth, async (req, res) => {
    const warehouses = await prisma.warehouse.findMany({
        where: { userId: req.userId },
        include: { locations: true },
        orderBy: { name: "asc" },
    });
    res.json(warehouses);
});

app.post("/api/warehouses", auth, async (req, res) => {
    const { name, shortCode, address } = req.body || {};
    if (!name || !shortCode) return res.status(400).json({ error: "Name and short code are required." });

    try {
        const warehouse = await prisma.warehouse.create({
            data: { userId: req.userId, name, shortCode, address: address || null },
        });
        res.status(201).json(warehouse);
    } catch (error) {
        res.status(400).json({ error: error.code === "P2002" ? "That warehouse short code already exists." : error.message });
    }
});

app.get("/api/locations", auth, async (req, res) => {
    const locations = await prisma.location.findMany({
        where: { warehouse: { userId: req.userId } },
        include: { warehouse: true },
        orderBy: { name: "asc" },
    });
    res.json(locations.map((l) => ({
        id: l.id,
        name: l.name,
        shortCode: l.shortCode,
        warehouseName: l.warehouse.name,
    })));
});

app.post("/api/locations", auth, async (req, res) => {
    const { name, shortCode, warehouseId } = req.body || {};
    if (!name || !shortCode || !warehouseId) {
        return res.status(400).json({ error: "Warehouse, name, and short code are required." });
    }

    const warehouse = await prisma.warehouse.findFirst({ where: { id: warehouseId, userId: req.userId } });
    if (!warehouse) return res.status(404).json({ error: "Warehouse not found." });

    try {
        const location = await prisma.location.create({
            data: { name, shortCode, warehouseId },
        });
        res.status(201).json(location);
    } catch (error) {
        res.status(400).json({ error: error.code === "P2002" ? "That location short code already exists in this warehouse." : error.message });
    }
});

/* Operations */

app.get("/api/operations/:id", auth, async (req, res) => {
    const operation = await prisma.operation.findFirst({
        where: { id: req.params.id, userId: req.userId },
    });
    if (!operation) return res.status(404).json({ error: "Operation not found." });
    res.json(await operationJson(operation));
});

app.post("/api/operations", auth, async (req, res) => {
    try {
        const body = req.body || {};
        const type = body.type;
        if (!["RECEIPT", "DELIVERY", "INTERNAL"].includes(type)) {
            return res.status(400).json({ error: "Choose a valid operation type." });
        }

        const operation = await prisma.$transaction(async (tx) => {
            const lines = await resolveLines(tx, req.userId, body.lines);
            const from = await findLocation(tx, req.userId, body.fromLocation);
            const to = await findLocation(tx, req.userId, body.toLocation);

            const created = await tx.operation.create({
                data: {
                    userId: req.userId,
                    reference: `${type.slice(0, 3)}-${Date.now()}`,
                    type,
                    status: "DRAFT",
                    contact: body.contact || null,
                    scheduledDate: body.scheduledDate ? new Date(body.scheduledDate) : null,
                    fromLocationId: from?.id || null,
                    toLocationId: to?.id || null,
                    lines: { create: lines },
                },
            });

            if (body.status === "DONE") {
                const full = await tx.operation.findUnique({
                    where: { id: created.id },
                    include: { lines: true },
                });
                await applyOperation(tx, full, req.userId);
                return tx.operation.update({ where: { id: created.id }, data: { status: "DONE" } });
            }

            return tx.operation.update({
                where: { id: created.id },
                data: { status: body.status || "DRAFT" },
            });
        });

        res.status(201).json(await operationJson(operation));
    } catch (error) {
        res.status(400).json({ error: error.message || "Could not create operation." });
    }
});

app.put("/api/operations/:id", auth, async (req, res) => {
    try {
        const result = await prisma.$transaction(async (tx) => {
            const current = await tx.operation.findFirst({
                where: { id: req.params.id, userId: req.userId },
                include: { lines: true },
            });
            if (!current) throw new Error("Operation not found.");
            if (current.status === "DONE") throw new Error("A completed operation cannot be changed.");

            const body = req.body || {};
            const lines = await resolveLines(tx, req.userId, body.lines || current.lines);
            const from = await findLocation(tx, req.userId, body.fromLocation);
            const to = await findLocation(tx, req.userId, body.toLocation);

            const updated = await tx.operation.update({
                where: { id: current.id },
                data: {
                    contact: body.contact ?? current.contact,
                    scheduledDate: body.scheduledDate ? new Date(body.scheduledDate) : current.scheduledDate,
                    fromLocationId: from?.id || null,
                    toLocationId: to?.id || null,
                    lines: { deleteMany: {}, create: lines },
                },
            });

            if (body.status === "DONE") {
                const full = await tx.operation.findUnique({
                    where: { id: updated.id },
                    include: { lines: true },
                });
                await applyOperation(tx, full, req.userId);
            }

            return tx.operation.update({
                where: { id: updated.id },
                data: { status: body.status || current.status },
            });
        });

        res.json(await operationJson(result));
    } catch (error) {
        res.status(400).json({ error: error.message || "Could not update operation." });
    }
});

/* Stock adjustment */

app.get("/api/stock-level", auth, async (req, res) => {
    const { productId, locationId } = req.query;
    const product = await prisma.product.findFirst({ where: { id: String(productId), userId: req.userId } });
    const location = await findLocation(prisma, req.userId, String(locationId || ""));
    if (!product || !location) return res.json({ onHand: 0 });

    const row = await prisma.stockLevel.findUnique({
        where: { productId_locationId: { productId: product.id, locationId: location.id } },
    });
    res.json({ onHand: row?.onHand || 0 });
});

app.post("/api/adjustments", auth, async (req, res) => {
    const { productId, locationId, countedQty } = req.body || {};
    const counted = Number(countedQty);
    if (!Number.isInteger(counted) || counted < 0) {
        return res.status(400).json({ error: "Physical count must be a non-negative whole number." });
    }

    try {
        const move = await prisma.$transaction(async (tx) => {
            const product = await tx.product.findFirst({ where: { id: productId, userId: req.userId } });
            const location = await findLocation(tx, req.userId, locationId);
            if (!product || !location) throw new Error("Choose a valid product and location.");

            const old = await tx.stockLevel.findUnique({
                where: { productId_locationId: { productId: product.id, locationId: location.id } },
            });
            const previous = old?.onHand || 0;
            const delta = counted - previous;

            await tx.stockLevel.upsert({
                where: { productId_locationId: { productId: product.id, locationId: location.id } },
                create: { productId: product.id, locationId: location.id, onHand: counted },
                update: { onHand: counted },
            });

            return tx.stockMove.create({
                data: {
                    userId: req.userId,
                    reference: `ADJ-${Date.now()}`,
                    productId: product.id,
                    type: "ADJUSTMENT",
                    status: "DONE",
                    toLocationId: location.id,
                    quantity: delta,
                    previousQuantity: previous,
                    countedQuantity: counted,
                },
            });
        });

        res.status(201).json(move);
    } catch (error) {
        res.status(400).json({ error: error.message || "Could not apply adjustment." });
    }
});

app.get("/api/adjustments", auth, async (req, res) => {
    const limit = Math.min(Number(req.query.limit || 10), 100);
    const moves = await prisma.stockMove.findMany({
        where: { userId: req.userId, type: "ADJUSTMENT" },
        include: { product: true, toLocation: true },
        orderBy: { timestamp: "desc" },
        take: limit,
    });

    res.json(moves.map((m) => ({
        id: m.id,
        productName: m.product.name,
        locationName: m.toLocation?.name || "",
        systemQty: m.previousQuantity,
        countedQty: m.countedQuantity,
    })));
});

/* Immutable movement ledger */

app.get("/api/moves", auth, async (req, res) => {
    const moves = await prisma.stockMove.findMany({
        where: { userId: req.userId },
        include: { product: true, fromLocation: true, toLocation: true },
        orderBy: { timestamp: "desc" },
    });

    res.json(moves.map((m) => ({
        id: m.id,
        reference: m.reference,
        date: m.timestamp.toISOString(),
        contact: m.contact,
        productSku: m.product.sku,
        fromLocation: m.fromLocation?.name || null,
        toLocation: m.toLocation?.name || null,
        quantity: m.quantity,
        type: m.type,
        status: m.status,
    })));
});

app.get("/api/health", (_req, res) => res.json({ status: "ok" }));

app.use((error, _req, res, _next) => {
    console.error(error);
    res.status(500).json({ error: "Unexpected server error." });
});

let server;

async function start() {
    await prisma.$connect();
    server = app.listen(PORT, () => {
        console.log(`StockSense API listening at http://localhost:${PORT}`);
    });
}

async function shutdown() {
    if (server) await new Promise((resolve) => server.close(resolve));
    await prisma.$disconnect();
}

start().catch(async (error) => {
    console.error("Could not start StockSense API:", error.message);
    await prisma.$disconnect();
    process.exitCode = 1;
});

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);