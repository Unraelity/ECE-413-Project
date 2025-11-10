var express = require('express');
var router = express.Router();
var Student = require("../models/student");

// CRUD implementation

router.post("/create", function (req, res) {
    const newStudent = new Student({
        name: req.body.name,
        major: req.body.major,
        gpa: req.body.gpa
    });
    newStudent.save(function (err, student) {
        if (err) {
            res.status(400).send(err);
        }
        else {
            let msgStr = `Student (${req.body.name}) info has been saved.`;
            res.status(201).json({ message: msgStr });
            console.log(msgStr);
        }
    });
});

router.get('/readAll', function (req, res) {
    Student.find(function (err, docs) {
        if (err) {
            let msgStr = `Something wrong....`;
            res.status(201).json({ message: msgStr });
        }
        else {
            res.status(201).json(docs);
        }
    });
});

router.get('/count', function (req, res) {
    Student.estimatedDocumentCount(function (err, count) {
        if (err) {
            let msgStr = `Something wrong....`;
            res.status(201).json({ message: msgStr });
        }
        else {
            res.status(201).json({ count: count });
        }
    });
});

router.post("/update", function (req, res) {
    Student.findOneAndUpdate({ name: req.body.name }, req.body, function (err, doc) {
        if (err) {
            let msgStr = `Something wrong....`;
            res.status(201).json({ message: msgStr, err: err });
        }
        else {
            let msgStr;
            if (doc == null) {
                msgStr = `Student (name: ${req.body.name}) info does not exist in DB.`;
            }
            else {
                msgStr = `Student (name: ${req.body.name}) info has been updated.`;
            }
            res.status(201).json({ message: msgStr });
        }
    })
});

router.post("/delete", function (req, res) {
    Student.deleteOne({ name: req.body.name }, function (err, result) {
        if (err) {
            let msgStr = `Something wrong....`;
            res.status(201).json({ message: msgStr, err: err });
        }
        else {
            let msgStr = result;
            res.status(201).json({ message: msgStr });
        }
    })
});

router.post("/search", function (req, res) {
    Student.find({ gpa: { $gt: req.body.gpa } }, function (err, docs) {
        if (err) {
            let msgStr = `Something wrong....`;
            res.status(201).json({ message: msgStr });
        }
        else {
            res.status(201).json(docs);
        }
    });
});

router.post("/read", function (req, res) {
    Student.find({ name: req.body.name }, function (err, docs) {
        if (err) {
            let msgStr = `Something wrong....`;
            res.status(201).json({ message: msgStr });
        }
        else {
            res.status(201).json(docs);
        }
    });
});

module.exports = router;