const todoDataValidation = ({ todoText }) => {
  return new Promise((resolve, reject) => {
    console.log(todoText);
    if (!todoText) reject("Missing todo text");

    if (typeof todoText !== "string") reject("todo text is not a text");

    if (todoText.length < 3 || todoText.length > 100)
      reject("todo text length should be 3-100");

    resolve();
  });
};

module.exports = { todoDataValidation };
