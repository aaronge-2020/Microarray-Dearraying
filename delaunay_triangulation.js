import * as d3 from "https://esm.sh/d3@7.8.5";

import * as math from "https://esm.sh/mathjs@12.2.0";

import * as Plotly from "https://cdn.jsdelivr.net/npm/plotly.js-dist/+esm";

function preprocessCores(cores) {
  // If cores is an object, convert it to an array
  if (typeof cores === "object" && !Array.isArray(cores)) {
    cores = Object.values(cores);
  }

  const minX = Math.min(...cores.map((core) => core.x));
  const minY = Math.min(...cores.map((core) => core.y));

  window.preprocessingData = {
    minX,
    minY,
  };

  // Normalize the coordinates
  return cores.map((core) => {
    // Perform the transformation
    core.x = core.x - minX;
    core.y = core.y - minY;

    return core;
  });
}

function getEdgesFromTriangulation(cores) {
  const delaunay = d3.Delaunay.from(cores.map((core) => [core.x, core.y]));
  const triangles = delaunay.triangles;
  const edges = new Set();

  for (let i = 0; i < triangles.length; i += 3) {
    for (let j = 0; j < 3; j++) {
      const index1 = triangles[i + j];
      const index2 = triangles[i + ((j + 1) % 3)];
      const edge = [Math.min(index1, index2), Math.max(index1, index2)]; // Ensuring smaller index comes first
      edges.add(edge.join(","));
    }
  }

  return Array.from(edges).map((edge) => edge.split(",").map(Number));
}

function calculateEdgeLengths(edges, coordinates) {
  return edges.map(([start, end]) => {
    const dx = coordinates[end].x - coordinates[start].x;
    const dy = coordinates[end].y - coordinates[start].y;
    return Math.sqrt(dx * dx + dy * dy);
  });
}
function orderEdgesToPointRight(filteredEdges, coordinates) {
  return filteredEdges.map(([start, end]) => {
    return coordinates[start].x > coordinates[end].x
      ? [end, start]
      : [start, end];
  });
}
function filterEdgesByLength(edges, coordinates, thresholdMultiplier = 1.5) {
  const edgeLengths = calculateEdgeLengths(edges, coordinates);
  const median = math.median(edgeLengths);
  const mad = math.median(edgeLengths.map((len) => Math.abs(len - median)));
  const lowerBound = median - thresholdMultiplier * mad;
  const upperBound = median + thresholdMultiplier * mad;

  const filteredEdges = edges.filter((edge, index) => {
    const length = edgeLengths[index];
    return length <= upperBound;
  });

  return orderEdgesToPointRight(filteredEdges, coordinates);
}
function angleWithXAxis(startCoord, endCoord) {
  const dx = endCoord.x - startCoord.x;
  const dy = endCoord.y - startCoord.y;
  const angleRadians = Math.atan2(dy, dx);
  return angleRadians * (180 / Math.PI);
}

function filterEdgesByAngle(edges, coordinates, thresholdAngle, originAngle) {
  return edges.filter(([start, end]) => {
    const startCoord = coordinates[start];
    const endCoord = coordinates[end];
    const angle = angleWithXAxis(startCoord, endCoord);

    // Normalize angles to be within -180 to 180 degrees
    let normalizedAngle = normalizeAngleDegrees(angle);

    // Check if the edge angle is within the threshold from the origin angle
    return (
      normalizedAngle <= originAngle + thresholdAngle &&
      normalizedAngle >= originAngle - thresholdAngle
    );
  });
}

function limitConnections(edges, coordinates) {
  // Step 1: Calculate distances for all connections
  let allConnections = {};
  edges.forEach((edge) => {
    const [pointA, pointB] = edge;
    const dx = coordinates[pointB].x - coordinates[pointA].x;
    const dy = coordinates[pointB].y - coordinates[pointA].y;
    const distance = Math.sqrt(dx * dx + dy * dy);

    allConnections[pointA] = allConnections[pointA] || [];
    allConnections[pointB] = allConnections[pointB] || [];
    allConnections[pointA].push({ point: pointB, distance: distance });
    allConnections[pointB].push({ point: pointA, distance: distance });
  });

  // Step 2: Sort connections for each point
  Object.keys(allConnections).forEach((point) => {
    allConnections[point].sort((a, b) => a.distance - b.distance);
  });

  // Step 3: Select the closest point in each direction mutually
  let mutualConnections = {};
  Object.keys(allConnections).forEach((point) => {
    allConnections[point].forEach((connection) => {
      const connectedPoint = connection.point;
      if (coordinates[connectedPoint].x < coordinates[point].x) {
        // Connected point is to the left
        if (
          !mutualConnections[point] ||
          !mutualConnections[point].left ||
          connection.distance < mutualConnections[point].left.distance
        ) {
          mutualConnections[point] = mutualConnections[point] || {};
          mutualConnections[point].left = {
            point: connectedPoint,
            distance: connection.distance,
          };
        }
      } else if (coordinates[connectedPoint].x > coordinates[point].x) {
        // Connected point is to the right
        if (
          !mutualConnections[point] ||
          !mutualConnections[point].right ||
          connection.distance < mutualConnections[point].right.distance
        ) {
          mutualConnections[point] = mutualConnections[point] || {};
          mutualConnections[point].right = {
            point: connectedPoint,
            distance: connection.distance,
          };
        }
      }
    });
  });

  // Step 4: Confirm the directionality is mutual
  let finalEdges = new Set();
  Object.keys(mutualConnections).forEach((point) => {
    const directions = mutualConnections[point];
    Object.keys(directions).forEach((direction) => {
      const connectedPoint = directions[direction].point;
      const oppositeDirection = direction === "right" ? "left" : "right";
      if (
        mutualConnections[connectedPoint] &&
        mutualConnections[connectedPoint][oppositeDirection] &&
        mutualConnections[connectedPoint][oppositeDirection].point == point
      ) {
        finalEdges.add(
          JSON.stringify(
            [
              Math.min(point, connectedPoint),
              Math.max(point, connectedPoint),
            ].sort()
          )
        );
      }
    });
  });

  // Return the list of final edges
  return Array.from(finalEdges).map((edge) => JSON.parse(edge));
}

function visualizeCores(cores, svgId) {
  const svg = d3.select(svgId);
  svg
    .selectAll("circle")
    .data(cores)
    .enter()
    .append("circle")
    .attr("cx", (d) => d.x)
    .attr("cy", (d) => d.y)
    .attr("r", 3)
    .attr("fill", "blue");
}

function visualizeEdges(edges, coordinates, svgId, color = "black") {
  const svg = d3.select(svgId);
  edges.forEach((edge) => {
    const [start, end] = edge;
    svg
      .append("line")
      .attr("x1", coordinates[start].x)
      .attr("y1", coordinates[start].y)
      .attr("x2", coordinates[end].x)
      .attr("y2", coordinates[end].y)
      .attr("stroke", color)
      .attr("stroke-width", 1);
  });
}

// Helper function to calculate distance between two points
function calculateDistance(p1, p2) {
  return Math.sqrt(Math.pow(p1[0] - p2[0], 2) + Math.pow(p1[1] - p2[1], 2));
}

// Helper function to normalize an angle between 0 and 360 degrees
function normalizeAngleDegrees(angle) {
  return angle % 360;
}

// Helper function to check if a point is within the circular sector
function pointInSector(V_prime, Vj, r, phi = 360, originAngle = 0) {
  let distance = calculateDistance(V_prime, Vj);
  if (distance > r) return false;

  return true;

  // let angleVjVPrime = angleWithXAxis(Vj, V_prime);
  // let startAngle = normalizeAngleDegrees(originAngle - phi / 2);
  // let endAngle = normalizeAngleDegrees(originAngle + phi / 2);
  // angleVjVPrime = normalizeAngleDegrees(angleVjVPrime);

  // if (startAngle < endAngle) {
  //     return startAngle <= angleVjVPrime && angleVjVPrime <= endAngle;
  // } else {
  //     return angleVjVPrime >= startAngle || angleVjVPrime <= endAngle;
  // }
}

// Helper function to check if point is close to image width
function isCloseToImageWidth(point, imageWidth, gamma) {
  return Math.abs(point[0] - imageWidth) < gamma;
}

// Main traveling algorithm
function traveling_algorithm(
  S,
  imageWidth,
  d,
  gamma,
  phi = 180,
  originAngle = 0,
  radiusMultiplier = 0.5
) {
  let A = [];
  let r = radiusMultiplier * d;
  let imaginaryPointsIndex = -1;

  S = S.map((v, i) => ({
    start: v[0],
    end: v[1],
    index: i,
    isImaginary: false,
  }));

  let firstImaginary = true;
  let imaginaryPointsCounter = 0; // Counter for consecutive imaginary points

  while (S.length > 0) {
    let startVector = S.reduce((prev, curr) =>
      prev.start[0] < curr.start[0] ? prev : curr
    );
    let A1 = [startVector];
    let Vj = startVector.end;
    S = S.filter((v) => v.index !== startVector.index);

    while (true) {

      let nextVector = S.find((v) => calculateDistance(v.start, Vj) < 1e-1);
      if (nextVector) {
        Vj = nextVector.end;
        A1.push(nextVector);
        S = S.filter((v) => v.index !== nextVector.index);
        firstImaginary = true;
        imaginaryPointsCounter = 0;
        
      } else {
        if (!isCloseToImageWidth(Vj, imageWidth, gamma)) {
          let candidates = S.filter((v) =>
            pointInSector(v.start, Vj, r, phi, originAngle)
          );
          if (candidates.length > 0) {
            let closestVector = candidates.reduce((prev, curr) =>
              calculateDistance(curr.end, Vj) < calculateDistance(prev.end, Vj)
                ? curr
                : prev
            );
            Vj = closestVector.end;
            A1.push(closestVector);
            S = S.filter((v) => v.index !== closestVector.index);
            firstImaginary = true;
            imaginaryPointsCounter = 0;

          } else {
            let deltaRad = originAngle * (Math.PI / 180);
            let VjPrime = [
              Vj[0] + d * Math.cos(deltaRad),
              Vj[1] + d * Math.sin(deltaRad),
            ];
            let imaginaryVector = {
              start: Vj,
              end: VjPrime,
              index: imaginaryPointsIndex,
              isImaginary: true,
            };

            if (firstImaginary) {
              imaginaryVector.isImaginary = false;
            } else {
              imaginaryPointsCounter++; // Increment counter for each consecutive imaginary point
            }

            if (imaginaryPointsCounter > 50) {
              alert(
                "Invalid hyperparameters: too many consecutive imaginary points."
              );
              throw new Error(
                "Invalid stopping distance: too many consecutive imaginary points."
              );
            }

            A1.push(imaginaryVector);
            Vj = VjPrime;
            imaginaryPointsIndex--;
            firstImaginary = false;

          }
        } else {
          let uniqueRow = A1.map((vec) => ({
            point: vec.start,
            index: vec.index,
            isImaginary: vec.isImaginary,
          })).filter(
            (v, i, self) =>
              self.findIndex(
                (t) => t.point[0] === v.point[0] && t.point[1] === v.point[1]
              ) === i
          );
          A.push(uniqueRow);
          firstImaginary = true;
          imaginaryPointsCounter = 0;

          break;
        }
      }
    }
  }
  return A;
}

function isPointInList(pointIndex, edgeList) {
  return edgeList.some(
    (edge) => edge[0] === pointIndex || edge[1] === pointIndex
  );
}

function sortEdgesAndAddIsolatedPoints(bestEdgeSet, normalizedCoordinates) {
  // Sort edges so that the point with the smaller x-coordinate comes first
  let sortedEdges = bestEdgeSet.map((edge) => {
    const [start, end] = edge;
    return normalizedCoordinates[start].x <= normalizedCoordinates[end].x
      ? [start, end]
      : [end, start];
  });

  // Find all indices that are not included in any edge
  let isolatedIndices = normalizedCoordinates
    .map((_, index) => index)
    .filter((index) => !isPointInList(index, sortedEdges));

  // Create edges for isolated points (self-referential)
  let isolatedPointsInput = isolatedIndices.map((index) => [index, index]);

  // Combine sorted edges with isolated points
  let bestEdgeSetIndices = sortedEdges.concat(isolatedPointsInput);

  return bestEdgeSetIndices;
}

function visualizeSortedRows(rows, plotDivId, minX, minY) {
  // Prepare the data for Plotly
  let realPoints = {
    x: [],
    y: [],
    type: "scatter",
    mode: "markers",
    name: "Real Points",
    marker: { color: "blue" },
    text: [],
    hoverinfo: "text",
    hovertemplate: "%{text}",
  };
  let imaginaryPoints = {
    x: [],
    y: [],
    type: "scatter",
    mode: "markers",
    name: "Imaginary Points",
    marker: { color: "red" },
    text: [],
    hoverinfo: "text",
    hovertemplate: "%{text}",
  };

  window.finalCores = [];

  rows.forEach((row, rowIdx) => {
    row.forEach((pointInfo, colIdx) => {
      const x = pointInfo.point[0] + minX;
      const y = pointInfo.point[1] + minY;
      const hoverText = `Row: ${rowIdx}, Col: ${colIdx}, X: ${x.toFixed(
        2
      )}, Y: ${y.toFixed(2)}`;

      if (pointInfo.isImaginary) {
        imaginaryPoints.x.push(x);
        imaginaryPoints.y.push(-y);
        imaginaryPoints.text.push(hoverText);
      } else {
        // Use original coordinates

        realPoints.x.push(x);
        realPoints.y.push(-y);
        realPoints.text.push(hoverText);
      }

      // Save final results to window.finalCores
      window.finalCores.push({
        row: rowIdx,
        col: colIdx,
        x: x,
        y: y,
        isImaginary: pointInfo.isImaginary,
      });
    });
  });

  // Define layout for the plot
  const layout = {
    title: "Sorted Rows Visualization",
    xaxis: {
      title: "X coordinate",
    },
    yaxis: {
      title: "Y coordinate",
    },
    hovermode: "closest", // Display the hover info for the closest point
    margin: { t: 40 }, // Adjust top margin to accommodate the title
  };

  // Combine real and imaginary points data
  const data = [realPoints, imaginaryPoints];

  // Create the plot using Plotly
  Plotly.default.newPlot(plotDivId, data, layout);
}

function averageEdgeLength(vectors) {
  // Create a map to store the connections
  const pointsMap = new Map();

  // Populate the map with vector connections
  vectors.forEach(([start, end]) => {
    if (!pointsMap.has(start)) pointsMap.set(start, new Set());
    if (!pointsMap.has(end)) pointsMap.set(end, new Set());

    pointsMap.get(start).add(end);
    pointsMap.get(end).add(start);
  });

  // Recursive function to build edges
  function buildEdge(start, visited) {
    const edge = [start];
    pointsMap.get(start).forEach((end) => {
      if (!visited.has(end)) {
        visited.add(end);
        edge.push(...buildEdge(end, visited));
      }
    });
    return edge;
  }

  // Find all unique edges
  const allEdges = [];
  const visited = new Set();
  pointsMap.forEach((_, start) => {
    if (!visited.has(start)) {
      visited.add(start);
      const edge = buildEdge(start, visited);
      // Filter duplicates and maintain order
      const orderedEdge = Array.from(new Set(edge));
      if (
        orderedEdge.length > 1 ||
        orderedEdge[0] === orderedEdge[orderedEdge.length - 1]
      ) {
        allEdges.push(orderedEdge);
      }
    }
  });

  // Filter to keep only the longest edges
  const finalEdges = allEdges.filter((edge) => {
    return !allEdges.some((existingEdge) => {
      const isSubset = edge.every((val) => existingEdge.includes(val));
      return isSubset && existingEdge.length > edge.length;
    });
  });

  // Calculate the average edge length
  const averageLength =
    finalEdges.reduce((acc, edge) => acc + edge.length, 0) / finalEdges.length;
  return isNaN(averageLength) ? 0 : averageLength;
}

async function determineImageRotation(
  normalizedCoordinates,
  length_filtered_edges,
  minAngle,
  maxAngle,
  angleStepSize,
  angleThreshold
) {
  // Assuming `readJson` is an async function to read and parse JSON data from a file
  let bestEdgeSet = null;
  let bestEdgeSetLength = 0;
  let optimalAngle = minAngle;

  for (let i = minAngle; i < maxAngle; i += angleStepSize) {
    let edgesSet = filterEdgesByAngle(
      length_filtered_edges,
      normalizedCoordinates,
      angleThreshold,
      i
    );
    edgesSet = limitConnections(edgesSet, normalizedCoordinates);
    edgesSet = sortEdgesAndAddIsolatedPoints(edgesSet, normalizedCoordinates);
    let setLength = averageEdgeLength(edgesSet);
    if (setLength > bestEdgeSetLength) {
      bestEdgeSetLength = setLength;
      bestEdgeSet = edgesSet;
      optimalAngle = i;
    }
  }

  return [bestEdgeSet, bestEdgeSetLength, optimalAngle];
}
function calculateGridWidth(centers, d, multiplier) {
  let maxX = Math.max(...centers.map((center) => center.x));
  return maxX + multiplier * d;
}

function calculateAverageDistance(coordinatesInput) {
  let averageDistances = [];
  for (let edge of coordinatesInput) {
    let start = edge[0],
      end = edge[1];
    let distance = Math.sqrt(
      Math.pow(start[0] - end[0], 2) + Math.pow(start[1] - end[1], 2)
    );
    averageDistances.push(distance);
  }

  return math.median(averageDistances); // Assuming median is a function you have defined or imported
}

export {
  preprocessCores,
  getEdgesFromTriangulation,
  filterEdgesByAngle,
  filterEdgesByLength,
  limitConnections,
  visualizeCores,
  visualizeEdges,
  visualizeSortedRows,
  calculateGridWidth,
  calculateAverageDistance,
  determineImageRotation,
  traveling_algorithm,
  sortEdgesAndAddIsolatedPoints,
};
// Call the function to load data and visualize
// loadDataAndVisualize().catch(error => console.error('An error occurred:', error));
