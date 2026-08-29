# GUI Feature Alignment — Batch Plan

## Context

clsswjz-agent is a sync replica of a personal bookkeeping system. Several entity definitions already exist (ActivityDefinition, ActivityRecord, Vehicle, FuelRecord) and are registered in `ConnectionManager.USER_ENTITIES` and `LogRunner.TYPE_MAP`, but lack REST controllers and web pages. Fund/Account has only a read-only endpoint. This plan adds CRUD + web UI for all missing modules in three batches.

## Key Invariants

- All entities already in `USER_ENTITIES` → SQLite auto-creates tables (`synchronize: true`)
- All `BusinessType` enums already mapped in `LogRunner.TYPE_MAP` → sync replay works out of the box
- Every write must create a `LogSync` record (see `CategoryService` for reference pattern)
- **book-scoped entities** (`BaseBusinessEntityWithAccountBook`): ActivityDefinition, ActivityRecord → `parentType: 'book'`
- **global entities** (`BaseBusinessEntity`): Vehicle, FuelRecord → no `parentType`
- IDs are 32-char nanoid, timestamps are epoch ms

---

## Batch 1: Fund CRUD

### Backend

**`src/funds/fund.service.ts`** — add `create`, `update`, `remove` methods following CategoryService pattern:
- `create(userId, data)`: save entity + LogSync (BusinessType.FUND, OperateType.CREATE, parentType: 'book')
- `update(userId, id, data)`: update + LogSync (OperateType.UPDATE)
- `remove(userId, id)`: delete + LogSync (OperateType.DELETE)

**`src/funds/fund.controller.ts`** — add `POST`, `PUT :id`, `DELETE :id` endpoints

### Frontend

**`web/src/api/index.ts`** — fundApi add `create`, `update`, `delete`

**`web/src/views/settings/Funds.vue`** — upgrade to editable:
- Add "+ 新增账户" button in header
- Each card gets edit/delete actions (dropdown menu)
- el-dialog with form: name, fundType (select), fundBalance, fundRemark, isDefault toggle
- Mobile: same card layout, actions via swipe or long-press

### Tests

- `src/funds/fund.service.spec.ts` — CRUD + LogSync verification

---

## Batch 2: Activity (Check-in)

### Backend — new `src/activity/` module

**Entities** (already exist):
- `ActivityDefinition` (book-scoped): name, emoji, color, sortOrder, maxDailyCount
- `ActivityRecord` (book-scoped): activityName, location, recordDate, activityDefId, maxDailyCount, remark

**`src/activity/activity.service.ts`**:
- ActivityDefinition: findAll(query by accountBookId), findOne, create, update, remove
- ActivityRecord: findAll(query by accountBookId + activityDefId + date range), create, remove

**`src/activity/activity.controller.ts`**:
- `GET/POST/PUT/DELETE /api/activity-defs` (book-scoped)
- `GET/POST /api/activity-records` (book-scoped, queryable by activityDefId + date)
- `DELETE /api/activity-records/:id`

**`src/activity/activity.module.ts`** — register controller + service

**`src/app.module.ts`** — add ActivityModule import

### Frontend

**`web/src/api/index.ts`** — add `activityDefApi` + `activityRecordApi`

**`web/src/views/Activities.vue`** — main page:
- Activity definition list as chips/cards (emoji + name + color)
- Click an activity → show its records grouped by date
- "打卡" button to add record (current date, optional location/remark)
- el-dialog for creating/editing activity definitions

**`web/src/router/index.ts`** — add `/activities` route

**`web/src/views/Features.vue`** — add "活动打卡" to lifeItems

### Tests

- `src/activity/activity.service.spec.ts` — definition CRUD + record CRUD + date query

---

## Batch 3: Vehicle + Fuel Records

### Backend — two new modules

**`src/vehicle/` module**:
- Entity: Vehicle (global, no accountBookId): plateNumber, brand, model, remark, defaultFuelGrade, isActive, sortOrder
- Controller: `GET/POST/PUT/DELETE /api/vehicles`
- BusinessType.VEHICLE, no parentType

**`src/fuel/` module**:
- Entity: FuelRecord (global): vehicleId, mileage, energyType, fuelGrade, volume, unitPrice, totalAmount, isFullTank, isFuelLightOn, station, remark, refuelTime, linkedBookId, linkedItemId
- Controller: `GET/POST/PUT/DELETE /api/fuel-records` (queryable by vehicleId)
- BusinessType.FUEL_RECORD, no parentType

**`src/app.module.ts`** — add VehicleModule + FuelModule

### Frontend

**`web/src/api/index.ts`** — add `vehicleApi` + `fuelRecordApi`

**`web/src/views/Vehicles.vue`** — vehicle management:
- Vehicle cards (plate number + brand + model)
- CRUD dialog with form fields
- Link to view fuel records for that vehicle

**`web/src/views/FuelRecords.vue`** — fuel record list + form:
- Filter by vehicle dropdown
- Record cards: date, mileage, fuel details, amount, station
- el-dialog form for add/edit

**`web/src/router/index.ts`** — add `/vehicles`, `/fuel-records` routes

**`web/src/views/Features.vue`** — add "车辆管理" and "加油记录" to lifeItems

### Tests

- `src/vehicle/vehicle.service.spec.ts`
- `src/fuel/fuel.service.spec.ts`

---

## File Change Summary

### New files (Batch 2 + 3)
- `src/activity/activity.module.ts`
- `src/activity/activity.controller.ts`
- `src/activity/activity.service.ts`
- `src/activity/activity.service.spec.ts`
- `src/vehicle/vehicle.module.ts`
- `src/vehicle/vehicle.controller.ts`
- `src/vehicle/vehicle.service.ts`
- `src/vehicle/vehicle.service.spec.ts`
- `src/fuel/fuel.module.ts`
- `src/fuel/fuel.controller.ts`
- `src/fuel/fuel.service.ts`
- `src/fuel/fuel.service.spec.ts`
- `web/src/views/Activities.vue`
- `web/src/views/Vehicles.vue`
- `web/src/views/FuelRecords.vue`

### Modified files
- `src/funds/fund.service.ts` (add create/update/remove)
- `src/funds/fund.controller.ts` (add POST/PUT/DELETE)
- `src/app.module.ts` (add ActivityModule, VehicleModule, FuelModule)
- `web/src/api/index.ts` (add all new APIs)
- `web/src/router/index.ts` (add 3 routes)
- `web/src/views/Features.vue` (add 3 hub entries)
- `web/src/views/settings/Funds.vue` (upgrade to editable)

### Test files
- `src/funds/fund.service.spec.ts` (new)
- `src/activity/activity.service.spec.ts` (new)
- `src/vehicle/vehicle.service.spec.ts` (new)
- `src/fuel/fuel.service.spec.ts` (new)
