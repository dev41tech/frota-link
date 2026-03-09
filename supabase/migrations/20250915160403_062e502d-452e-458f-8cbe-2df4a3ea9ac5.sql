-- Clear test data from vehicles, journeys, fuel_expenses, and expenses tables
-- This will remove all existing data so users can start fresh

-- Delete fuel expenses (depends on journeys)
DELETE FROM fuel_expenses;

-- Delete expenses (depends on journeys and vehicles)
DELETE FROM expenses;

-- Delete revenue (depends on journeys)
DELETE FROM revenue;

-- Delete journeys (depends on vehicles and drivers)
DELETE FROM journeys;

-- Delete drivers
DELETE FROM drivers;

-- Delete vehicles
DELETE FROM vehicles;

-- Delete gas stations
DELETE FROM gas_stations;

-- Delete accounts payable
DELETE FROM accounts_payable;