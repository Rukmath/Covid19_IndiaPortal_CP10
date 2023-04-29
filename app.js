const express = require("express");
const path = require("path");
const { open } = require("sqlite");
const sqlite3 = require("sqlite3");

const dbPath = path.join(__dirname, "covid19IndiaPortal.db");

const app = express();
app.use(express.json());

const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

let db;

const initializeDBAndServer = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    });
    app.listen(3000, () =>
      console.log("Server Running at http://localhost:3000/")
    );
  } catch (e) {
    console.log(e.message);
  }
};

initializeDBAndServer();

const convertStateObjectToResponseObject = (dbObject) => {
  return {
    stateId: dbObject.state_id,
    stateName: dbObject.state_name,
    population: dbObject.population,
  };
};

const convertDistrictObjectToResponseObject = (dbObject) => {
  return {
    districtId: dbObject.district_id,
    districtName: dbObject.district_name,
    stateId: dbObject.state_id,
    cases: dbObject.cases,
    cured: dbObject.cured,
    active: dbObject.active,
    deaths: dbObject.deaths,
  };
};

const authenticateToken = (request, response, next) => {
  let jwtToken;
  const authorization = request.headers["authorization"];

  if (authorization !== undefined) {
    jwtToken = authorization.split(" ")[1];
  }

  if (jwtToken === undefined) {
    response.status(401);
    response.send("Invalid JWT Token");
  } else {
    jwt.verify(jwtToken, "qwerty", async (error, payload) => {
      if (error) {
        response.status(401);
        response.send("Invalid JWT Token");
      } else {
        next();
      }
    });
  }
};

//login user API
app.post("/login/", async (request, response) => {
  let jwtToken;
  const { username, password } = request.body;
  const hashPassword = await bcrypt.hash(password, 10);
  const selectUserQuery = `SELECT * FROM user WHERE username = '${username}';`;
  const dbUser = await db.get(selectUserQuery);

  if (dbUser === undefined) {
    response.status(400);
    response.send("Invalid user");
  } else {
    const isPasswordMatched = await bcrypt.compare(password, dbUser.password);

    if (isPasswordMatched === true) {
      const payload = { username: username };

      jwtToken = jwt.sign(payload, "qwerty");
      response.send({ jwtToken });
    } else {
      response.status(400);
      response.send("Invalid password");
    }
  }
});

//GET STATES API
app.get("/states/", authenticateToken, async (request, response) => {
  const getStatesQuery = `SELECT * FROM state;`;
  const statesArray = await db.all(getStatesQuery);
  response.send(
    statesArray.map((eachState) =>
      convertStateObjectToResponseObject(eachState)
    )
  );
});

//GET STATE BASED ON ID API
app.get("/states/:stateId/", authenticateToken, async (request, response) => {
  const { stateId } = request.params;
  const getStateQuery = `SELECT * FROM state WHERE state_id = '${stateId}';`;
  const state = await db.get(getStateQuery);
  response.send(convertStateObjectToResponseObject(state));
});

//CREATE district in district table API
app.post("/districts/", authenticateToken, async (request, response) => {
  const { districtName, stateId, cases, cured, active, deaths } = request.body;
  const createDistrictQuery = `INSERT INTO district ( district_name,state_id,cases,cured,active,deaths) 
     VALUES (
         '${districtName}',
         '${stateId}',
         '${cases}',
         '${cured}',
         '${active}',
         '${deaths}'
     );`;
  await db.run(createDistrictQuery);
  response.send("District Successfully Added");
});

//GET DISTRICT BASED ON ID API
app.get(
  "/districts/:districtId/",
  authenticateToken,
  async (request, response) => {
    const { districtId } = request.params;
    const getDistrictQuery = `SELECT * FROM district WHERE district_id = '${districtId}';`;
    const district = await db.get(getDistrictQuery);
    response.send(convertDistrictObjectToResponseObject(district));
  }
);

//DELETE DISTRICT API
app.delete(
  "/districts/:districtId/",
  authenticateToken,
  async (request, response) => {
    const { districtId } = request.params;
    const deleteDistrictQuery = `DELETE  FROM district WHERE district_id = '${districtId}';`;
    await db.run(deleteDistrictQuery);
    response.send("District Removed");
  }
);

//UPDATE DISTRICT API
app.put(
  "/districts/:districtId/",
  authenticateToken,
  async (request, response) => {
    const { districtId } = request.params;
    const {
      districtName,
      stateId,
      cases,
      cured,
      active,
      deaths,
    } = request.body;
    const updateDistrictQuery = `
    UPDATE 
      district 
    SET 
      district_name = '${districtName}',
      state_id = '${stateId}',
      cases = '${cases}',
      cured = '${cured}',
      active = '${active}', 
      deaths = '${deaths}'
  WHERE
    district_id = ${districtId};
  `;
    await db.run(updateDistrictQuery);
    response.send("District Details Updated");
  }
);

//GET STATISTICS OF TOTAL CASES API
app.get(
  "/states/:stateId/stats/",
  authenticateToken,
  async (request, response) => {
    const { stateId } = request.params;
    const getStatsQuery = `SELECT
      SUM(cases) AS totalCases,
      SUM(cured) AS totalCured,
      SUM(active) AS totalActive,
      SUM(deaths) AS totalDeaths
    FROM district
    WHERE state_id = '${stateId}';`;
    const stats = await db.get(getStatsQuery);
    console.log(stats);
    response.send(stats);
  }
);

module.exports = app;
