// database is let instead of const to allow us to modify it in test.js
let database = {
  users: {},
  articles: {},
  nextArticleId: 1,
  comments: {},
  nextCommentId: 1
};

const routes = {
  '/users': {
    'POST': getOrCreateUser
  },
  '/users/:username': {
    'GET': getUser
  },
  '/articles': {
    'GET': getArticles,
    'POST': createArticle
  },
  '/articles/:id': {
    'GET': getArticle,
    'PUT': updateArticle,
    'DELETE': deleteArticle
  },
  '/articles/:id/upvote': {
    'PUT': upvoteArticle
  },
  '/articles/:id/downvote': {
    'PUT': downvoteArticle
  },
  '/comments': {
    'POST': createComment
  },
  '/comments/:id': {
    'PUT': updateComment,
    'DELETE': deleteComment
  },
  '/comments/:id/upvote': {
    'PUT': upvoteComment
  },
  '/comments/:id/downvote': {
    'PUT': downvoteComment
  }
};

function isObjEmpty(obj) {
  return Object.keys(obj).length === 0 && obj.constructor === Object;
}

function include(array, elem) {
  for (let item of array) {
    if (item === elem) {
      return true;
    }
  }
  return false;
}

function removeElement(array, elem) {
  var copy = [...array]
  var index = copy.indexOf(elem);
  if (index > -1) {
    copy.splice(index, 1);
  }
  return copy;
}


function getUser(url, request) {
  const username = url.split('/').filter(segment => segment)[1];
  const user = database.users[username];
  const response = {};

  if (user) {
    const userArticles = user.articleIds.map(
        articleId => database.articles[articleId]);
    const userComments = user.commentIds.map(
        commentId => database.comments[commentId]);
    response.body = {
      user: user,
      userArticles: userArticles,
      userComments: userComments
    };
    response.status = 200;
  } else if (username) {
    response.status = 404;
  } else {
    response.status = 400;
  }

  return response;
}

function getOrCreateUser(url, request) {
  const username = request.body && request.body.username;
  const response = {};

  if (database.users[username]) {
    response.body = {user: database.users[username]};
    response.status = 200;
  } else if (username) {
    const user = {
      username: username,
      articleIds: [],
      commentIds: []
    };
    database.users[username] = user;

    response.body = {user: user};
    response.status = 201;
  } else {
    response.status = 400;
  }

  return response;
}

function getArticles(url, request) {
  const response = {};

  response.status = 200;
  response.body = {
    articles: Object.keys(database.articles)
        .map(articleId => database.articles[articleId])
        .filter(article => article)
        .sort((article1, article2) => article2.id - article1.id)
  };

  return response;
}

function getArticle(url, request) {
  const id = Number(url.split('/').filter(segment => segment)[1]);
  const article = database.articles[id];
  const response = {};

  if (article) {
    article.comments = article.commentIds.map(
      commentId => database.comments[commentId]);

    response.body = {article: article};
    response.status = 200;
  } else if (id) {
    response.status = 404;
  } else {
    response.status = 400;
  }

  return response;
}

function createArticle(url, request) {
  const requestArticle = request.body && request.body.article;
  const response = {};

  if (requestArticle && requestArticle.title && requestArticle.url &&
      requestArticle.username && database.users[requestArticle.username]) {
    const article = {
      id: database.nextArticleId++,
      title: requestArticle.title,
      url: requestArticle.url,
      username: requestArticle.username,
      commentIds: [],
      upvotedBy: [],
      downvotedBy: []
    };

    database.articles[article.id] = article;
    database.users[article.username].articleIds.push(article.id);

    response.body = {article: article};
    response.status = 201;
  } else {
    response.status = 400;
  }

  return response;
}

function updateArticle(url, request) {
  const id = Number(url.split('/').filter(segment => segment)[1]);
  const savedArticle = database.articles[id];
  const requestArticle = request.body && request.body.article;
  const response = {};

  if (!id || !requestArticle) {
    response.status = 400;
  } else if (!savedArticle) {
    response.status = 404;
  } else {
    savedArticle.title = requestArticle.title || savedArticle.title;
    savedArticle.url = requestArticle.url || savedArticle.url;

    response.body = {article: savedArticle};
    response.status = 200;
  }

  return response;
}

function deleteArticle(url, request) {
  const id = Number(url.split('/').filter(segment => segment)[1]);
  const savedArticle = database.articles[id];
  const response = {};

  if (savedArticle) {
    database.articles[id] = null;
    savedArticle.commentIds.forEach(commentId => {
      const comment = database.comments[commentId];
      database.comments[commentId] = null;
      const userCommentIds = database.users[comment.username].commentIds;
      userCommentIds.splice(userCommentIds.indexOf(id), 1);
    });
    const userArticleIds = database.users[savedArticle.username].articleIds;
    userArticleIds.splice(userArticleIds.indexOf(id), 1);
    response.status = 204;
  } else {
    response.status = 400;
  }

  return response;
}

function upvoteArticle(url, request) {
  const id = Number(url.split('/').filter(segment => segment)[1]);
  const username = request.body && request.body.username;
  let savedArticle = database.articles[id];
  const response = {};

  if (savedArticle && database.users[username]) {
    savedArticle = upvote(savedArticle, username);

    response.body = {article: savedArticle};
    response.status = 200;
  } else {
    response.status = 400;
  }

  return response;
}

function downvoteArticle(url, request) {
  const id = Number(url.split('/').filter(segment => segment)[1]);
  const username = request.body && request.body.username;
  let savedArticle = database.articles[id];
  const response = {};

  if (savedArticle && database.users[username]) {
    savedArticle = downvote(savedArticle, username);

    response.body = {article: savedArticle};
    response.status = 200;
  } else {
    response.status = 400;
  }

  return response;
}

function createComment(url, request) {

  // check request
  if(isObjEmpty(request) ||
     isObjEmpty(request.body) ||
     isObjEmpty(request.body.comment)) {
       return {status:400};
     }

  let nextId = database.nextCommentId;
  let body = request.body.comment.body;
  let username = request.body.comment.username;
  let articleId = request.body.comment.articleId;

  // check required fields
  if(!body || !username || !articleId) {
    return {status:400};
  }

  // check if user and article exist in database
  if(!database.users[username] || !database.articles[articleId]) {
    return {status:400};
  }

  // create new comment
  const newComment = {
    id: nextId,
    body: body,
    username: username,
    articleId: articleId,
    upvotedBy: [],
    downvotedBy: []
  }

  // update database
  database.comments[nextId] = newComment;
  database.users[username].commentIds.push(nextId);
  database.articles[articleId].commentIds.push(nextId);

  // increment nextCommentId
  database.nextCommentId++;

  return {status:201, body: {comment: newComment}};
}

function updateComment(url, request) {

  let commentId = Number(url.slice(10));

  if(isObjEmpty(request) ||
     isObjEmpty(request.body) ||
     isObjEmpty(request.body.comment)) {
       return {status:400};
     }

  let updatedBody = request.body.comment.body

  if(!updatedBody) {
    return {status:400};
  }

  if (!database.comments[commentId]) {
    return {status: 404};
  }

  database.comments[commentId].body = updatedBody;

  return {status:200};
}

function deleteComment(url, request) {

  let commentId = Number(url.slice(10));

  if (!database.comments[commentId]) {
    return {status: 404};
  }

  let username = database.comments[commentId].username;
  let articleId = database.comments[commentId].articleId;


  database.comments[commentId] = null;
  database.users[username].commentIds = removeElement(database.users[username].commentIds, commentId);
  database.articles[articleId].commentIds = removeElement(database.articles[articleId].commentIds, commentId);

  return {status: 204};

}

function upvoteComment(url, request) {

  if(isObjEmpty(request) || isObjEmpty(request.body)) {
    return {status:400};
  }

  let upvoteUser = request.body.username;
  let commentId = Number(url.slice(10,-7));

  if(!upvoteUser || !database.users[upvoteUser] || !database.comments[commentId]) {
    return {status: 400};
  }

  if(!include(database.comments[commentId].upvotedBy, upvoteUser)) {
    database.comments[commentId].upvotedBy.push(upvoteUser);
    if(include(database.comments[commentId].downvotedBy, upvoteUser)) {
      database.comments[commentId].downvotedBy = removeElement(database.comments[commentId].downvotedBy, upvoteUser)
    }

  }
  return {status: 200, body: { comment: database.comments[commentId]}};
}

function downvoteComment(url, request) {

  if(isObjEmpty(request) || isObjEmpty(request.body)) {
    return {status:400};
  }

  let downvoteUser = request.body.username;
  let commentId = Number(url.slice(10,-9));

  if(!downvoteUser || !database.users[downvoteUser] || !database.comments[commentId]) {
    return {status: 400};
  }

  if(!include(database.comments[commentId].downvotedBy, downvoteUser)) {
    database.comments[commentId].downvotedBy.push(downvoteUser);
    if(include(database.comments[commentId].upvotedBy, downvoteUser)) {
      database.comments[commentId].upvotedBy = removeElement(database.comments[commentId].upvotedBy, downvoteUser)
    }
  }
  return {status: 200, body: { comment: database.comments[commentId]}};
}

function upvote(item, username) {
  if (item.downvotedBy.includes(username)) {
    item.downvotedBy.splice(item.downvotedBy.indexOf(username), 1);
  }
  if (!item.upvotedBy.includes(username)) {
    item.upvotedBy.push(username);
  }
  return item;
}

function downvote(item, username) {
  if (item.upvotedBy.includes(username)) {
    item.upvotedBy.splice(item.upvotedBy.indexOf(username), 1);
  }
  if (!item.downvotedBy.includes(username)) {
    item.downvotedBy.push(username);
  }
  return item;
}

// Write all code above this line.

const http = require('http');
const url = require('url');

const port = process.env.PORT || 4000;
const isTestMode = process.env.IS_TEST_MODE;

const requestHandler = (request, response) => {
  const url = request.url;
  const method = request.method;
  const route = getRequestRoute(url);

  if (method === 'OPTIONS') {
    var headers = {};
    headers["Access-Control-Allow-Origin"] = "*";
    headers["Access-Control-Allow-Methods"] = "POST, GET, PUT, DELETE, OPTIONS";
    headers["Access-Control-Allow-Credentials"] = false;
    headers["Access-Control-Max-Age"] = '86400'; // 24 hours
    headers["Access-Control-Allow-Headers"] = "X-Requested-With, X-HTTP-Method-Override, Content-Type, Accept";
    response.writeHead(200, headers);
    return response.end();
  }

  response.setHeader('Access-Control-Allow-Origin', '*');
  response.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  response.setHeader(
      'Access-Control-Allow-Headers', 'X-Requested-With,content-type');

  if (!routes[route] || !routes[route][method]) {
    response.statusCode = 400;
    return response.end();
  }

  if (method === 'GET' || method === 'DELETE') {
    const methodResponse = routes[route][method].call(null, url);
    !isTestMode && (typeof saveDatabase === 'function') && saveDatabase();

    response.statusCode = methodResponse.status;
    response.end(JSON.stringify(methodResponse.body) || '');
  } else {
    let body = [];
    request.on('data', (chunk) => {
      body.push(chunk);
    }).on('end', () => {
      body = JSON.parse(Buffer.concat(body).toString());
      const jsonRequest = {body: body};
      const methodResponse = routes[route][method].call(null, url, jsonRequest);
      !isTestMode && (typeof saveDatabase === 'function') && saveDatabase();

      response.statusCode = methodResponse.status;
      response.end(JSON.stringify(methodResponse.body) || '');
    });
  }
};

const getRequestRoute = (url) => {
  const pathSegments = url.split('/').filter(segment => segment);

  if (pathSegments.length === 1) {
    return `/${pathSegments[0]}`;
  } else if (pathSegments[2] === 'upvote' || pathSegments[2] === 'downvote') {
    return `/${pathSegments[0]}/:id/${pathSegments[2]}`;
  } else if (pathSegments[0] === 'users') {
    return `/${pathSegments[0]}/:username`;
  } else {
    return `/${pathSegments[0]}/:id`;
  }
}

if (typeof loadDatabase === 'function' && !isTestMode) {
  const savedDatabase = loadDatabase();
  if (savedDatabase) {
    for (key in database) {
      database[key] = savedDatabase[key] || database[key];
    }
  }
}

const server = http.createServer(requestHandler);

server.listen(port, (err) => {
  if (err) {
    return console.log('Server did not start succesfully: ', err);
  }

  console.log(`Server is listening on ${port}`);
});
