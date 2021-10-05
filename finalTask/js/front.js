let socket = io();

//サイドバーのオブジェクト群
//チャンネルリストのオブジェクト
let channels = document.getElementById('channels');
let classNames = document.querySelectorAll('.classNames');
let selected = document.getElementsByClassName('selected');
//ボタンのオブジェクト
let addRoom = document.getElementById('addRoom');
let addPriRoom = document.getElementById('addPriRoom');
let updateBtn = document.getElementById('updateBtn');
//プライベートルーム招待用フォームのオブジェクト
let invitationForm = document.getElementById('invitationForm');
let invitationInput = document.getElementById('invitationInput');
let invitationHidden = document.getElementById('invitationHidden')

//コンテンツエリアのオブジェクト群
//メッセージ送信フォームのオブジェクト
let messageForm = document.getElementById('messageForm');
let messageInput = document.getElementById('messageInput');
//メッセージリストに表示されるコンテンツのオブジェクト
let messages = document.getElementById('messages');
let imgs = document.getElementsByClassName("imgs");

//変数の初期設定
let nowRoom = "general";
let judge = false;


//ニックネーム初期設定を起動
setNickname();

// 初期room設定
socket.emit('set roomname', "general", "normal");
const file = document.getElementById('file');
file.addEventListener('change', sendImage, false);
invitationHidden.style.display = "none";


//function

//ニックネーム初期設定
function setNickname() {
    const nickName = prompt('ニックネームを決めてください');
    socket.emit('set nickname', nickName);
}

//room名指定
function joinRoom(roomType) {
    const roomName = prompt('部屋の名前を決めてください');
    socket.emit('set roomname', roomName, roomType);
}



//チャンネルリスト追加
//追加するルームの種類を得るためのroomTypeと現在のルームと照合するためのchannnelName
function appendChanenl(channelName, roomType) {
    let item = document.createElement('li');
    item.classList.add('classNames');

    //追加するルームに応じたクラスを付与する
    if (roomType == 'normal') {
        item.classList.add('normal');
    } else if (roomType == 'private') {
        item.classList.add('private');
        judge = 'private';
    }

    item.textContent = channelName;
    if (channelName == nowRoom) {
        item.removeAttribute('notSelected')
        item.classList.add('selected');
        if (judge == 'private') {
            judge = 'priAndselect'
        }
    } else {
        item.removeAttribute('selected');
        item.classList.add('notSelected');
    }
    console.log(nowRoom + ' : nowRoom');
    channels.appendChild(item);

    //追加されたチャンネルにクリックイベントを設定（追加後でないとセレクタを拾えない？ためこの位置）
    //イベント内容:クリックしたチャンネルへ移動
    item.addEventListener('click', (e) => {

        console.log(item.innerHTML + ":hazimarii");
        console.log(item);
        let temp;
        if (item.classList.contains('private') == true) {
            temp = 'private';

        } else {
            temp = 'normal';
        }
        socket.emit('set roomname', item.innerHTML, temp);

    })
}


//メッセージ追加
function showMessage(message, name, id) {
    let item = document.createElement('li');
    let posterName = document.createElement('span');
    let msgtext=document.createElement('p');

    msgtext.textContent = message;
    posterName.textContent = name;

    item.appendChild(posterName);
    item.appendChild(msgtext);
    messages.appendChild(item);
    window.scrollTo(0, document.body.scrollHeight);
}

function showAnnounce(message, name, id) {
    let item = document.createElement('li');
    item.textContent = message;

    messages.appendChild(item);
    window.scrollTo(0, document.body.scrollHeight);
}


//img追加
//画像データを文字列で受け取りlistに追加
function imgDataShow(imgData) {
    let canvas = document.createElement('canvas');
    let ctx = canvas.getContext('2d');
    let img = new Image();
    img.src = imgData;
    img.onload = () => {
        canvas.width = img.width;
        canvas.height = img.height
        ctx.drawImage(img, 0, 0);
        imgShow(canvas);
    }

}


//受け取った画像データをlistに追加する
function imgShow(img) {
    let item = document.createElement('li');
    item.appendChild(img); //一度imgをliの子要素に追加してからliをulの子要素に追加
    messages.appendChild(item);
    window.scrollTo(0, document.body.scrollHeight);
}

function inviteHidden(showOrHide) {
    //selectedクラスを持っているタグがprivateクラスも持っているなら、招待用フォームを表示
    if (showOrHide) {
        invitationHidden.style.display = "block";
    } else {
        invitationHidden.style.display = "none";
    }
}

//画像送信
function sendImage(event) {
    console.log("change!");
    let file = event.target.files[0];
    let reader = new FileReader();

    reader.onload = (event) => {
        socket.emit('image', event.target.result);
        imgDataShow(event.target.result);
    };

    reader.readAsDataURL(file);

}




//addEventListener

//スタンプ押した時

for (let i = 0; i < imgs.length; i++) {
    imgs[i].addEventListener('click', function(e) {
        socket.emit('stampId', e.target.id);

    }, false)
}

//入力の完了をemit
messageInput.addEventListener('blur', (e) => {
    socket.emit('blur', 'typed');
});

messageForm.addEventListener('submit', (e) => {
    e.preventDefault();
    if (messageInput.value) {
        showAnnounce(messageInput.value);

        socket.emit('chat message', messageInput.value);
        messageInput.value = '';
    }
});

//ルーム追加ボタンクリック処理
addRoom.addEventListener('click', (e) => {
    joinRoom("normal");
});

addPriRoom.addEventListener('click', (e) => {
    joinRoom("private");
});

updateBtn.addEventListener('click', (e) => {
    socket.emit('update btn click');
})

//プライベートルーム招待用form
invitationForm.addEventListener('submit', (e) => {
    e.preventDefault();
    if (invitationInput.value) {
        socket.emit('invitation', invitationInput.value);
        invitationInput.value = '';
        console.log('招待送信');
    }
})

//タイプ中であることをemit
messageInput.addEventListener('focus', (e) => {
    socket.emit('focus', 'is typing');
});


//socket.on

socket.on('chat message', (msg) => {
    showAnnounce(msg);
});

socket.on('user connect', (msg) => { //todo アナウンスと一つにまとめる
    showAnnounce('通知: ' + msg);
});
socket.on('disconnected', (msg) => {
    showAnnounce('通知: ' + msg);
});

socket.on('announce', (msg) => {
    showAnnounce('通知: ' + msg);
});

socket.on('now room update', (roomName) => {
    nowRoom = roomName;
})

//リスト更新
socket.on('ch list update', (chList, priList, roomName) => {
    channels.innerHTML = "";
    let tempSet = new Set(priList);

    for (let ch of chList) {
        if (tempSet.has(ch)) {
            appendChanenl(ch, 'private')
            if (judge == 'priAndselect') {
                judge = true;
            } else {
                judge = false;
            }
        } else {
            appendChanenl(ch, 'normal');
        }


    }
    console.log(judge + ' : judge');
    inviteHidden(judge);
    judge = "";
});


//スタンプ受け取り時
socket.on('stamp', (e) => {
    let stamp = document.getElementById(e);
    let clone_element = stamp.cloneNode(true);
    imgShow(clone_element);
})



//ユーザーがタイプ中であることを受け取り名前とともに表示
socket.on('focus', (nickname) => {
    showAnnounce(`通知: ${nickname}が入力中...`);
});



//入力の完了を受け取り名前とともに表示
socket.on('blur', (nickname) => {
    showAnnounce(`通知: ${nickname}が入力を終えました`);
});


//リストリセット
socket.on('list Reset', (e) => {

    channels.innerHTML = "";
    console.log('1');

});

//メッセージリストをリセット
socket.on('reset messages', () => {
    messages.innerHTML = "";
})



//画像を受け取って表示させる
socket.on('image', function(imageData) {
    if (imageData) {
        imgDataShow(imageData);
    }
});

