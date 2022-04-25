# electron robot demo

1. 安裝

    `npm install`

2. 執行

    `npm start`

3. Debug

    `npm run debug`

4. 測試
    ```
        curl --location --request POST 'http://localhost:3005/robot/10' \
        --header 'Content-Type: application/json' \
        --data-raw '{
            "account": "robot",
            "round": "30",
            "testNo": "test"
        }'
    ```