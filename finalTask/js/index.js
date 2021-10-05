const express = require('express');
const app = express();
const http = require('http');
const server = http.createServer(app);
const { Server } = require("socket.io");
const io = new Server(server);
const fs = require('fs');
const csv = require('csv');
const e = require('express');
const { timeStamp } = require('console');

app.use(express.static('../'));


app.get('/', (req, res) => {
    res.sendFile(__dirname + '/../index.html');
});

let roomList = []; //ルーム名一覧
let rlset = new Set(); //ルーム名一覧作成用のset

let priList = []; //プライベートルーム名一覧
let pset = new Set(); //プライベートルーム名一覧作成用のset

//Object = { roomname: [array]}の形 新規ルームができるごとにroomnameが追加される
let priRoomData = {};


io.on('connection', (socket) => {
    console.log('a user connected');

    //ニックネーム設定処理
    socket.on('set nickname', (nickname) => {
        console.log(`${nickname} connected`);
        socket.nickname = nickname;

        //ニックネームでのルーム（自分へemitする時用）
        socket.join(nickname);
    });

    //ルーム参加処理
    socket.on('set roomname', (roomname, roomType) => {
        //ルーム名入力が不完全な場合
        if (roomname == null || roomname == '') {
            io.to(socket.nickname).emit('announce', "入力が不完全です");

            //追加ルームがプライベートの場合
        } else if (roomType == "private") {
            if (rlset.has(roomname)) { //既にあるルームかどうかを照合
                let temp1 = priRoomData[roomname];
                let tempSet = new Set(priRoomData[roomname]);

                if (tempSet.has(socket.nickname)) { //照合
                    joinRoom(roomname, roomType);
                    //名簿追加
                    priDataAdd(socket.nickname);

                } else {
                    //照合false
                    io.to(socket.nickname).emit('announce', "プライベートルームのため参加できません");
                    chNameOutput();
                }


            } else { //新規プライベートルーム
                joinRoom(roomname, roomType);
                priDataAdd(socket.nickname);
            }


        } else { //通常ルーム
            joinRoom(roomname, roomType);
        }


    });

    //ルームjoin処理
    function joinRoom(roomname, roomType) {
        console.log(`${roomname} join`);
        socket.roomname = roomname;
        socket.join(roomname);
        io.to(socket.nickname).emit('now room update', socket.roomname);

        resetMsgs(); //メッセージリストリセットのemit


        //サーバー側のルーム一覧を更新
        rlUpdate(roomType);
        //サイドバーのチャンネルリストを更新
        chNameOutput(roomname);

        //過去のログを表示する
        //csvを一行読み込む=>roomが一致していたらmesage/stampとしてemit を繰り返す
        logOutput(socket.roomname);
        //参加通知
        let msg = socket.nickname + "が" + socket.roomname + "に参加しました";
        io.to(socket.roomname).emit('user connect', msg);
        console.log(roomList + "roomlist");

        io.to(socket.nickname).emit('list reset perfect');
        io.to(socket.nickname).emit('now room update', roomname);

    }

    //csvログから入室した部屋のログを書き出す
    function logOutput(roomname) {
        fs.createReadStream('./../store.csv')
            .pipe(csv.parse({
                columns: false
            }, (err, data) => {
                //csv行ループ
                for (let i in data) {

                    //csvのデータを変数に保管
                    let nameL = data[i][0],
                        roomnameL = data[i][1],
                        dataTypeL = data[i][2],
                        messageL = data[i][3],
                        stampL = data[i][4];

                    //ルーム一致判定(一致しない場合書き出さない)
                    if (roomname == roomnameL) {
                        // console.log('OK');
                        //dataTypeでスタンプかチャットかを判定
                        switch (dataTypeL) {
                            case "message":
                                io.to(socket.nickname).emit('chat message', "[log] : " + nameL + '> ' + messageL);
                                break;

                            case "stamp":
                                io.to(socket.nickname).emit('stamp', stampL);
                                break;

                            default:
                                console.log("データタイプ未定");
                                break;
                        }
                    } 

                }

                io.to(socket.nickname).emit('chat message', "-------------ログここまで-------------");


            }));
    }

    //入力されたメッセージもしくはスタンプをcsvに保存
    function csvWrite(name, roomname, dataType, message, stamp) {
        console.log(name, message);
        fs.createReadStream('./../store.csv')
            .pipe(csv.parse({
                columns: false
            }, (err, data) => {
                let adddata = data;
                adddata.push([
                    name,
                    roomname,
                    dataType,
                    message,
                    stamp
                ]);

                console.log(adddata);


                csv.stringify(adddata, (err, data) => {
                    fs.writeFile('./../store.csv', data, (err) => {
                        console.log('csvファイルへの書き込みを完了');
                    });
                });

            }));
    }

    //サーバー側のルームリストを更新
    function rlUpdate(roomType) {
        if (!rlset.has(socket.roomname)) {
            roomList.push(socket.roomname);
            rlset.add(socket.roomname);
        }
        if (roomType == 'private' && !pset.has(socket.roomname)) {
            priList.push(socket.roomname);
            pset.add(socket.roomname);
        }
    }

    //存在するルーム名を配列で渡す
    function chNameOutput(roomname) {

        console.log(roomList);
        // io.to(socket.nickname).emit('ch list update', roomList);
        socket.emit('ch list update', roomList, priList, roomname);
        console.log("chNameOutput finish");
    }

    //メッセージをリセットするようにemit
    function resetMsgs() {
        io.to(socket.nickname).emit('reset messages');
    }

    //priRoomDataにユーザーを追加
    function priDataAdd(addUserName) {
        let arrayForCoalescence = [];
        let tempSet = new Set(priRoomData[socket.roomname]);

        //二人目以降かつ未参加者の場合
        if (priRoomData[socket.roomname] != undefined && !tempSet.has(addUserName)) {
            //新規参加者と既存名簿を合体
            arrayForCoalescence.push(priRoomData[socket.roomname]); //配列に配列をpush（配列が入れ子の状態）
            arrayForCoalescence.push(addUserName);

            //上の入れ子を解決
            priRoomData[socket.roomname] = arrayForCoalescence.flat(); //ブラケット記法で変数名に変数を使用

            //最初の一人の場合：undefind
        } else if (priRoomData[socket.roomname] == undefined) {
            arrayForCoalescence.push(addUserName);
            priRoomData[socket.roomname] = arrayForCoalescence;
        }


        console.log(priRoomData[socket.roomname]);
        console.log(priRoomData);

    }

    //更新ボタンclick時の処理
    socket.on('update btn click', () => {
        chNameOutput(socket.roomname);
    });

    //プライベートルームへのメンバーの追加
    socket.on('invitation', (inviteName) => {
        priDataAdd(inviteName);
        io.emit('announce', inviteName + "が" + socket.roomname + "のメンバーリストに追加されました");
    });

    socket.on('focus', () => {
        socket.broadcast.emit('focus', socket.nickname);
    });

    socket.on('blur', () => {
        socket.broadcast.emit('blur', socket.nickname);
    });

    socket.on('disconnect', () => {
        console.log('user disconnected');
        io.emit('disconnected', '誰かが退室しました');
    });

    socket.on('chat message', (msg) => {
        console.log('message: ' + msg);
        io.to(socket.roomname).emit('chat message', socket.nickname + '> ' + msg);
        csvWrite(socket.nickname, socket.roomname, "message", msg, "null");
    });

    // 追加
    socket.on('image', (imageData) => {
        socket.broadcast.emit('image', imageData);
        io.emit('chat message', '画像送信完了');
    });

    //スタンプID送受信
    socket.on('stampId', (id) => 　{
        io.emit('stamp', id);
        csvWrite(socket.nickname, socket.roomname, "stamp", "null", id);
    });


});

//サーバー起動時
server.listen(3000, () => {
    console.log('listening on *:3000');

    //ヘッドデータ
    const csvhead = [
        { name: 'name', roomname: 'general', dataType: 'dataType', message: 'messeage', stamp: 'stamp' }, //チャンネルリストの初期表示のためにroomnameはgeneralに指定
    ];
    //csvファイル初期化＋作成
    csv.stringify(csvhead, (err, data) => {
        fs.writeFile('./../store.csv', data, (err) => {
            console.log('csv作成処理完了');
        })
    })


});